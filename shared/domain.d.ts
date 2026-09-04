export interface Option { value: string; label: string }

export const DAY_TYPE: Option[];
export const BIAS: Option[];
export const SESSION_STATUS: Option[];
export const TIMEFRAMES: Option[];
export const COMMON_INSTRUMENTS: string[];
export const LEVEL_DIRECTION: Option[];
export const LEVEL_CLASSIFICATION: Option[];
export const LEVEL_IMPORTANCE: Option[];
export const LEVEL_SOURCE_SUGGESTIONS: string[];
export const SCREENSHOT_CATEGORY: Option[];
export const SCREENSHOT_ENTITY: string[];
export function labelOf(list: Option[], value: string | null | undefined): string;
