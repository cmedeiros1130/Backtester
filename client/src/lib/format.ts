/**
 * Display helpers.
 *
 * The house rule: a missing measurement renders as an em dash, never as 0.
 * "Not measured" and "measured as zero" mean completely different things when
 * the entire point of the platform is honest statistics.
 */

export const DASH = '—';

export function num(v: number | null | undefined, dp = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  return v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** Points: trims trailing zeros so 4.25 and 18 both read cleanly. */
export function pts(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  const rounded = Math.round(v * 100) / 100;
  return String(rounded);
}

export function pct(v: number | null | undefined, dp = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  return `${v.toFixed(dp)}%`;
}

export function int(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  return String(Math.round(v));
}

export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return DASH;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-09-04" -> "September 4, 2026". Parsed as a plain date, never shifted. */
export function longDate(isoDate: string | null | undefined): string {
  if (!isoDate) return DASH;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function shortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return DASH;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
}

/** "10:42" -> "10:42 AM". Accepts an ISO timestamp too. */
export function clock(value: string | null | undefined): string {
  if (!value) return DASH;
  let h: number;
  let m: number;
  const hhmm = value.match(/^(\d{1,2}):(\d{2})/);
  if (hhmm) {
    h = Number(hhmm[1]);
    m = Number(hhmm[2]);
  } else {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    h = d.getHours();
    m = d.getMinutes();
  }
  const suffix = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return DASH;
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const nowClock = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Colour ramp for a 0-100 process/accuracy score. Never used for money. */
export function scoreTone(v: number | null | undefined): 'good' | 'ok' | 'weak' | 'bad' | 'none' {
  if (v === null || v === undefined || Number.isNaN(v)) return 'none';
  if (v >= 80) return 'good';
  if (v >= 65) return 'ok';
  if (v >= 45) return 'weak';
  return 'bad';
}

export const TONE_TEXT: Record<string, string> = {
  good: 'text-[#2ec27e]',
  ok: 'text-[#7fc4ff]',
  weak: 'text-[#f5a524]',
  bad: 'text-[#f0575f]',
  none: 'text-fg-faint',
};

export const TONE_BG: Record<string, string> = {
  good: 'bg-[#2ec27e]',
  ok: 'bg-[#4d8dff]',
  weak: 'bg-[#f5a524]',
  bad: 'bg-[#f0575f]',
  none: 'bg-ink-600',
};

export const RESULT_TONE: Record<string, string> = {
  VALIDATED: 'good',
  PARTIALLY_VALIDATED: 'weak',
  FAILED: 'bad',
  NOT_TESTED: 'none',
  INVALID: 'none',
  CORRECT: 'good',
  PARTIAL: 'weak',
  INCORRECT: 'bad',
};
