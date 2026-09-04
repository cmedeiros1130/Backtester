/**
 * Shared vocabulary, imported by both the server and the client so a stored
 * value and the label shown for it can never drift apart.
 *
 * Deliberately short. Anything that needed a page of enums was a feature this
 * product no longer has.
 */

const opt = (value, label) => ({ value, label });

// --------------------------------------------------------------- the day ---
export const DAY_TYPE = [
  opt('RANGE', 'Range'),
  opt('BULL_TREND', 'Bull Trend'),
  opt('BEAR_TREND', 'Bear Trend'),
  opt('REVERSAL', 'Reversal'),
  opt('BREAKOUT', 'Breakout'),
  opt('UNCLEAR', 'Unclear'),
];

export const BIAS = [
  opt('BULLISH', 'Bullish'),
  opt('BEARISH', 'Bearish'),
  opt('NEUTRAL', 'Neutral'),
];

export const SESSION_STATUS = [
  opt('DRAFT', 'Draft'),
  opt('LOCKED', 'Locked'),
  opt('REVIEWED', 'Reviewed'),
];

// ------------------------------------------------------------ timeframes ---
// Every example carries one. Filtering by it is the whole point of recording
// the same level across several timeframes.
export const TIMEFRAMES = [
  opt('1m', '1 Minute'),
  opt('5m', '5 Minute'),
  opt('15m', '15 Minute'),
  opt('30m', '30 Minute'),
  opt('1h', '1 Hour'),
  opt('4h', '4 Hour'),
  opt('1D', 'Daily'),
];

export const COMMON_INSTRUMENTS = ['NQ', 'ES', 'MNQ', 'MES', 'YM', 'RTY', 'CL', 'GC', 'SPY', 'QQQ'];

// -------------------------------------------------------- level examples ---
export const DIRECTION = [
  opt('LONG', 'Long'),
  opt('SHORT', 'Short'),
  opt('EITHER', 'Either'),
];

export const LEVEL_RESULT = [
  opt('HELD', 'Held'),
  opt('RECLAIMED', 'Reclaimed'),
  opt('FAILED', 'Failed'),
  opt('BROKE', 'Broke'),
];

/** Which results count as the level having done its job. */
export const HELD_RESULTS = ['HELD', 'RECLAIMED'];

// ------------------------------------------------------------ screenshots ---
export const SCREENSHOT_CATEGORY = [
  opt('BEFORE', 'Before'),
  opt('AFTER', 'After'),
  opt('ANNOTATED', 'Annotated'),
  opt('MAIN', 'Main'),
  opt('SETUP', 'Setup'),
  opt('RESULT', 'Result'),
  opt('OTHER', 'Other'),
];

export const SCREENSHOT_ENTITY = [
  'SESSION',
  'DAY_PREDICTION',
  'DAY_REVIEW',
  'LEVEL_EXAMPLE',
  'MARKET_EXAMPLE',
];

export const labelOf = (list, value) =>
  list.find((o) => o.value === value)?.label ?? value ?? '—';
