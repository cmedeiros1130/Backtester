/**
 * Descriptive statistics.
 *
 * Averages alone hide the tails, and the tails are where levels fail, so every
 * distribution is reported with median and percentiles alongside the mean.
 */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Linear-interpolated percentile (same method as numpy's default). */
export function percentile(sortedAsc, p) {
  const n = sortedAsc.length;
  if (n === 0) return null;
  if (n === 1) return sortedAsc[0];
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (rank - lo);
}

/**
 * Full description of a numeric sample. Returns count: 0 with null stats when
 * there is nothing to describe -- never a fabricated zero.
 */
export function describe(values) {
  const nums = (values ?? []).filter(isNum);
  const count = nums.length;
  if (count === 0) {
    return {
      count: 0, mean: null, median: null, min: null, max: null, stdev: null,
      p25: null, p50: null, p75: null, p80: null, p90: null, p95: null, sum: 0,
    };
  }
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  // Sample standard deviation (n-1). Undefined for a single observation.
  const stdev =
    count > 1
      ? Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (count - 1))
      : null;
  return {
    count,
    sum,
    mean,
    median: percentile(sorted, 50),
    min: sorted[0],
    max: sorted[count - 1],
    stdev,
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p80: percentile(sorted, 80),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
  };
}

/**
 * A rate with its sample size attached. The UI always renders `n` next to the
 * percentage so a 100% success rate on 2 observations cannot masquerade as a
 * reliable statistic.
 */
export function rate(successes, total) {
  return {
    successes,
    total,
    pct: total > 0 ? (successes / total) * 100 : null,
  };
}

export function mean(values) {
  const nums = (values ?? []).filter(isNum);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Group an array of rows by a key function into a Map. */
export function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const k = keyFn(row);
    if (k === null || k === undefined) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}

export function round(value, dp = 2) {
  if (!isNum(value)) return null;
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/** Round every numeric field of a describe() result for transport. */
export function roundDescribe(d, dp = 2) {
  const out = { ...d };
  for (const k of ['mean', 'median', 'min', 'max', 'stdev', 'p25', 'p50', 'p75', 'p80', 'p90', 'p95', 'sum']) {
    out[k] = round(out[k], dp);
  }
  return out;
}
