/**
 * Shared date utilities for consistent date parsing and formatting
 * across the MCP server and iCal code.
 */

/**
 * Parse a date string as local time to avoid timezone shifts.
 * Strips any UTC indicator (Z) or timezone offset from the input.
 */
export const parseAsLocal = (dateStr: string): Date => {
  const localStr = dateStr.replace(/(Z|[+-]\d{2}:?\d{2})$/, '');
  return new Date(localStr);
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
export const formatLocale = (
  date: Date,
  locale: string = 'fi-FI',
): string => {
  return date.toLocaleString(locale);
};
