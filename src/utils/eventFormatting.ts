import { DateTime } from 'luxon';
import type { CalendarEvent } from '@/utils/calendar-events';
import { DEFAULT_TIMEZONE } from '@/utils/weekday';

/**
 * Format a Date object as a readable string with weekday.
 * Output: "YYYY-MM-DD (Weekday) HH:mm" or "YYYY-MM-DD (Weekday)" for midnight.
 */
const formatDate = (date: Date | null): string | null => {
  if (!date) return null;

  const dt = DateTime.fromJSDate(date).setZone(DEFAULT_TIMEZONE);
  const isMidnight = dt.hour === 0 && dt.minute === 0;

  if (isMidnight) {
    return dt.toFormat('yyyy-MM-dd (cccc)');
  }

  return dt.toFormat('yyyy-MM-dd (cccc) HH:mm');
};

/**
 * Format a single event as a display string.
 */
const formatEvent = (event: CalendarEvent): string => {
  const startStr = formatDate(event.start);
  const endStr = formatDate(event.end);

  const timeRange =
    endStr && endStr !== startStr
      ? `${startStr} to ${endStr}`
      : (startStr ?? 'No time');

  const location = event.location ? ` at ${event.location}` : '';

  return `- ${event.title}: ${timeRange}${location}`;
};

/**
 * Format a list of events as a display string.
 * Returns emptyMessage if no events.
 */
const formatEventList = (
  events: CalendarEvent[],
  emptyMessage: string = '',
): string => {
  if (events.length === 0) return emptyMessage;
  return events.map(formatEvent).join('\n');
};

/**
 * Format a Date as a localized datetime string.
 * Used for user-facing messages in MCP tool responses.
 */
const formatDateTime = (
  date: Date,
  options: {
    locale?: string;
    includeWeekday?: boolean;
    includeTime?: boolean;
  } = {},
): string => {
  const {
    locale = 'fi-FI',
    includeWeekday = true,
    includeTime = true,
  } = options;

  const dt = DateTime.fromJSDate(date)
    .setZone(DEFAULT_TIMEZONE)
    .setLocale(locale);

  // Build format string based on options
  let format = includeWeekday ? 'cccc d.M.yyyy' : 'd.M.yyyy';
  if (includeTime) {
    format += ' HH:mm';
  }

  return dt.toFormat(format);
};

/**
 * Format a time-only string from a Date.
 */
const formatTime = (date: Date): string => {
  return DateTime.fromJSDate(date).setZone(DEFAULT_TIMEZONE).toFormat('HH:mm');
};

export { formatEvent, formatEventList, formatDateTime, formatTime, formatDate };
