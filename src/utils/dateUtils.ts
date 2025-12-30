/**
 * Shared date utilities for consistent date parsing and formatting
 * across the MCP server and iCal code.
 */

/** Regex pattern to detect timezone indicators (Z or ±HH:MM offset) */
const TIMEZONE_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/;

/** Regex pattern for valid local ISO 8601 datetime (e.g., 2025-01-01T17:00:00) */
const LOCAL_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

export type ParseAsLocalOptions = {
  /**
   * When true (default), throws an error if the input contains a timezone indicator.
   * When false, silently strips timezone indicators (legacy behavior).
   */
  strict?: boolean;
};

/**
 * Parse a date string as local time to avoid timezone shifts.
 *
 * In strict mode (default), rejects inputs with timezone indicators (Z or offsets)
 * to ensure callers provide proper local time strings as documented.
 *
 * @throws Error if strict mode is enabled and input contains timezone indicator
 */
export const parseAsLocal = (
  dateStr: string,
  options: ParseAsLocalOptions = {},
): Date => {
  const { strict = true } = options;

  if (strict) {
    if (TIMEZONE_PATTERN.test(dateStr)) {
      throw new Error(
        `Invalid local datetime: "${dateStr}" contains a timezone indicator (Z or offset). ` +
          'Expected a local ISO 8601 string without timezone (e.g., 2025-01-01T17:00:00).',
      );
    }
    if (!LOCAL_DATETIME_PATTERN.test(dateStr)) {
      throw new Error(
        `Invalid local datetime format: "${dateStr}". ` +
          'Expected ISO 8601 format: YYYY-MM-DDTHH:mm:ss (e.g., 2025-01-01T17:00:00).',
      );
    }
  } else {
    // Legacy behavior: silently strip timezone indicators
    dateStr = dateStr.replace(TIMEZONE_PATTERN, '');
  }

  return new Date(dateStr);
};

/**
 * Format a Date as a UTC timestamp string (YYYYMMDDTHHMMSSZ).
 * Used for DTSTAMP fields in iCal.
 */
export const formatUTC = (date: Date): string =>
  date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

/**
 * Format a Date as a floating (local) timestamp string (YYYYMMDDTHHMMSS).
 * Used for DTSTART/DTEND fields without timezone specification.
 */
export const formatFloating = (date: Date): string => {
  const pad = (num: number) => num.toString().padStart(2, '0');
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
};

/**
 * Format a Date as a localized string for display purposes.
 * Uses Finnish locale by default for consistent display across the app.
 */
export const formatLocale = (date: Date, locale: string = 'fi-FI'): string => {
  return date.toLocaleString(locale);
};
