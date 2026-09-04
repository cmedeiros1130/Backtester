/**
 * Market data adapter layer.
 *
 * The application never talks to a data provider directly. Every source -- a
 * CSV export, a NinjaTrader dump, a future REST API -- is normalised here into
 * the same candle shape { ts, open, high, low, close, volume } with ts as UTC
 * epoch milliseconds. Adding a provider means adding an adapter, not touching
 * the replay engine or the database.
 */

// ---------------------------------------------------------------------------
// Timezone handling
// ---------------------------------------------------------------------------

/**
 * Convert naive wall-clock components in an IANA timezone to a UTC timestamp.
 * Two passes converge because a zone offset never shifts by more than an hour
 * within the correction window. Handles DST without a dependency.
 */
export function zonedToUtcMs(y, mo, d, h, mi, s, timeZone) {
  if (!timeZone || timeZone === 'UTC') return Date.UTC(y, mo - 1, d, h, mi, s);
  let utc = Date.UTC(y, mo - 1, d, h, mi, s);
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utc));
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const asZone = Date.UTC(
      Number(p.year), Number(p.month) - 1, Number(p.day),
      Number(p.hour) % 24, Number(p.minute), Number(p.second)
    );
    const target = Date.UTC(y, mo - 1, d, h, mi, s);
    const drift = target - asZone;
    if (drift === 0) break;
    utc += drift;
  }
  return utc;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function detectDelimiter(sampleLine) {
  const counts = [',', ';', '\t', '|'].map((d) => [d, sampleLine.split(d).length]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ',';
}

/** Minimal RFC4180-ish splitter: handles quoted fields containing delimiters. */
function splitLine(line, delim) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else { inQuotes = false; }
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const looksNumeric = (s) => s !== '' && !Number.isNaN(Number(s.replace(/,/g, '')));
const num = (s) => {
  if (s === undefined || s === null || s === '') return null;
  const v = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(v) ? v : null;
};

// ---------------------------------------------------------------------------
// Timestamp parsing
// ---------------------------------------------------------------------------

/**
 * Parse the many shapes a bar timestamp arrives in.
 * Returns epoch ms, or null if the value is not a recognisable timestamp.
 */
export function parseTimestamp(dateStr, timeStr, timeZone) {
  if (dateStr === undefined || dateStr === null) return null;
  const raw = String(dateStr).trim();
  if (!raw) return null;

  // Bare epoch (seconds or milliseconds)
  if (/^\d{9,13}$/.test(raw) && !timeStr) {
    const n = Number(raw);
    return raw.length <= 10 ? n * 1000 : n;
  }

  const combined = timeStr ? `${raw} ${String(timeStr).trim()}` : raw;

  // ISO 8601 with an explicit zone or Z -> trust it verbatim
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(combined)) {
    const t = Date.parse(combined.replace(' ', 'T'));
    return Number.isNaN(t) ? null : t;
  }

  // NinjaTrader compact: 20240102 093000  /  20240102 0930
  let m = combined.match(/^(\d{4})(\d{2})(\d{2})[ T]?(\d{2})?(\d{2})?(\d{2})?$/);
  if (m) {
    return zonedToUtcMs(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), timeZone);
  }

  // yyyy-mm-dd [hh:mm[:ss]]  or  yyyy/mm/dd
  m = combined.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return zonedToUtcMs(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), timeZone);
  }

  // mm/dd/yyyy [hh:mm[:ss]] [AM/PM]
  m = combined.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/
  );
  if (m) {
    let hour = +(m[4] ?? 0);
    const ampm = m[7]?.toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return zonedToUtcMs(+m[3], +m[1], +m[2], hour, +(m[5] ?? 0), +(m[6] ?? 0), timeZone);
  }

  const fallback = Date.parse(combined);
  return Number.isNaN(fallback) ? null : fallback;
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

const HEADER_ALIASES = {
  ts: ['timestamp', 'time', 'datetime', 'date_time', 'bartime', 'unix', 'epoch'],
  date: ['date', 'day'],
  time: ['time', 'bartime', 'clock'],
  open: ['open', 'o', 'openprice'],
  high: ['high', 'h', 'highprice'],
  low: ['low', 'l', 'lowprice'],
  close: ['close', 'c', 'closeprice', 'last', 'settle'],
  volume: ['volume', 'vol', 'v', 'tickvolume', 'totalvolume'],
};

const norm = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

function mapHeaders(headers) {
  const map = {};
  headers.forEach((h, idx) => {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(n) && map[field] === undefined) map[field] = idx;
    }
  });
  // "time" doubles as both a full timestamp and a clock column. If a separate
  // date column exists, treat it as the clock half.
  if (map.date !== undefined && map.ts === map.time) delete map.ts;
  return map;
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

export const ADAPTERS = [
  {
    id: 'NINJATRADER',
    name: 'NinjaTrader export (headerless, yyyyMMdd HHmmss)',
    detect: (headers, firstCells) =>
      headers === null && firstCells.length >= 5 && /^\d{8}[ ]?\d{0,6}$/.test(firstCells[0]),
    parse: (rows, tz) =>
      rows.map((cells) => ({
        ts: parseTimestamp(cells[0], null, tz),
        open: num(cells[1]),
        high: num(cells[2]),
        low: num(cells[3]),
        close: num(cells[4]),
        volume: num(cells[5]),
      })),
  },
  {
    id: 'CSV_HEADERLESS_OHLCV',
    name: 'Headerless date,open,high,low,close[,volume]',
    detect: (headers, firstCells) => headers === null && firstCells.length >= 5,
    parse: (rows, tz) =>
      rows.map((cells) => {
        // Either date,o,h,l,c,v  or  date,time,o,h,l,c,v
        const hasSeparateTime = !looksNumeric(cells[1]) || /^\d{1,2}:\d{2}/.test(cells[1]);
        const off = hasSeparateTime ? 1 : 0;
        return {
          ts: parseTimestamp(cells[0], hasSeparateTime ? cells[1] : null, tz),
          open: num(cells[1 + off]),
          high: num(cells[2 + off]),
          low: num(cells[3 + off]),
          close: num(cells[4 + off]),
          volume: num(cells[5 + off]),
        };
      }),
  },
  {
    id: 'CSV_GENERIC',
    name: 'CSV with headers',
    detect: (headers) => headers !== null,
    parse: (rows, tz, headers) => {
      const m = mapHeaders(headers);
      const missing = ['open', 'high', 'low', 'close'].filter((f) => m[f] === undefined);
      if (missing.length) {
        throw new Error(`CSV is missing required column(s): ${missing.join(', ')}`);
      }
      if (m.ts === undefined && m.date === undefined) {
        throw new Error('CSV has no recognisable date/time/timestamp column');
      }
      return rows.map((cells) => ({
        ts: parseTimestamp(
          m.ts !== undefined ? cells[m.ts] : cells[m.date],
          m.ts !== undefined ? null : m.time !== undefined ? cells[m.time] : null,
          tz
        ),
        open: num(cells[m.open]),
        high: num(cells[m.high]),
        low: num(cells[m.low]),
        close: num(cells[m.close]),
        volume: m.volume !== undefined ? num(cells[m.volume]) : null,
      }));
    },
  },
];

/**
 * Normalise raw file text into candles.
 * @returns {{candles: Array, adapter: string, headers: string[]|null, skipped: number}}
 */
export function parseMarketFile(text, { timeZone = 'UTC', adapterId = null } = {}) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  if (!lines.length) throw new Error('File is empty');

  const delim = detectDelimiter(lines[0]);
  const firstCells = splitLine(lines[0], delim);
  // A header row is one whose price columns are not numbers.
  const hasHeader = firstCells.slice(1, 5).some((c) => !looksNumeric(c));
  const headers = hasHeader ? firstCells : null;
  const bodyLines = hasHeader ? lines.slice(1) : lines;
  const rows = bodyLines.map((l) => splitLine(l, delim));

  const adapter = adapterId
    ? ADAPTERS.find((a) => a.id === adapterId)
    : ADAPTERS.find((a) => a.detect(headers, headers ? rows[0] ?? [] : firstCells));
  if (!adapter) throw new Error('Could not determine a data format for this file');

  const parsed = adapter.parse(rows, timeZone, headers);

  const seen = new Set();
  const candles = [];
  let skipped = 0;
  for (const c of parsed) {
    if (
      c.ts === null || !Number.isFinite(c.ts) ||
      c.open === null || c.high === null || c.low === null || c.close === null
    ) {
      skipped += 1;
      continue;
    }
    if (seen.has(c.ts)) { skipped += 1; continue; }
    seen.add(c.ts);
    candles.push(c);
  }
  candles.sort((a, b) => a.ts - b.ts);

  if (!candles.length) {
    throw new Error(`No usable rows found (${skipped} rows rejected). Check the date format and columns.`);
  }
  return { candles, adapter: adapter.id, headers, skipped };
}

/** Best-effort bar interval label, inferred from the median gap between bars. */
export function inferTimeframe(candles) {
  if (candles.length < 3) return null;
  const gaps = [];
  for (let i = 1; i < Math.min(candles.length, 500); i += 1) {
    gaps.push(candles[i].ts - candles[i - 1].ts);
  }
  gaps.sort((a, b) => a - b);
  const medianMs = gaps[Math.floor(gaps.length / 2)];
  const minutes = Math.round(medianMs / 60000);
  if (minutes >= 1440) return `${Math.round(minutes / 1440)}D`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  return minutes >= 1 ? `${minutes}m` : null;
}
