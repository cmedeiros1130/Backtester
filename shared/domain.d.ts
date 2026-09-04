export interface Option { value: string; label: string }

export const DAY_TYPE: Option[];
export const BIAS: Option[];
export const SESSION_STATUS: Option[];
export const TIMEFRAMES: Option[];
export const COMMON_INSTRUMENTS: string[];
export const DIRECTION: Option[];
export const LEVEL_RESULT: Option[];
export const HELD_RESULTS: string[];
export const SCREENSHOT_CATEGORY: Option[];
export const SCREENSHOT_ENTITY: string[];
export function labelOf(list: Option[], value: string | null | undefined): string;
