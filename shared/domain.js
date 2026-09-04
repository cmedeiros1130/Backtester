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

// ------------------------------------------------------ certified levels ---
// How a level has historically been worth trading.
export const LEVEL_DIRECTION = [
  opt('BUY', 'Buy'),
  opt('SELL', 'Sell'),
  opt('BOTH', 'Both'),
];

// Two independent verdicts: is it a level at all, and how much does it matter.
export const LEVEL_CLASSIFICATION = [
  opt('KEY_LEVEL', 'Key Level'),
  opt('WATCH_OUT_AREA', 'Watch Out Area'),
];

export const LEVEL_IMPORTANCE = [
  opt('MAJOR', 'Major'),
  opt('MINOR', 'Minor'),
];

/**
 * Suggestions only. The source field is free text -- these just save typing
 * and are never enforced.
 */
export const LEVEL_SOURCE_SUGGESTIONS = [
  '4H Previous Candle Low',
  '4H Previous Candle High',
  '1H High',
  '1H Low',
  'Previous Day High',
  'Previous Day Low',
  'Range High',
  'Range Low',
  'Trendline',
];

// ------------------------------------------------------------ screenshots ---
export const SCREENSHOT_CATEGORY = [
  opt('MAIN', 'Main Chart'),
  opt('EVIDENCE', 'Evidence'),
  opt('BEFORE', 'Before'),
  opt('AFTER', 'After'),
  opt('ANNOTATED', 'Annotated'),
  opt('OTHER', 'Other'),
];

export const SCREENSHOT_ENTITY = [
  'SESSION',
  'DAY_PREDICTION',
  'DAY_REVIEW',
  'CERTIFIED_LEVEL',
  'MARKET_EXAMPLE',
];

export const labelOf = (list, value) =>
  list.find((o) => o.value === value)?.label ?? value ?? '—';
