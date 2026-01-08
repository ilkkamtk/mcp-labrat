import { DateTime } from 'luxon';
import type { CalendarEvent } from '@/utils/calendar-events';
import { DEFAULT_TIMEZONE } from '@/utils/weekday';

/** Default locale for date/time formatting */
export const DEFAULT_LOCALE = 'fi-FI';

/**
 * Format a Date object as a readable string with weekday.
 * Output: "YYYY-MM-DD (Weekday) HH:mm" or "YYYY-MM-DD (Weekday)" for midnight.
 *
 * @param date - Date to format
 * @param timezone - IANA timezone for display. Defaults to DEFAULT_TIMEZONE.
 */
const formatDate = (
  date: Date | null,
  timezone: string = DEFAULT_TIMEZONE,
): string | null => {
  if (!date) return null;

  const dt = DateTime.fromJSDate(date).setZone(timezone);
  const isMidnight = dt.hour === 0 && dt.minute === 0;

  if (isMidnight) {
    return dt.toFormat('yyyy-MM-dd (cccc)');
  }

  return dt.toFormat('yyyy-MM-dd (cccc) HH:mm');
};

/**
 * Format a single event as a display string.
 *
 * @param event - Calendar event to format
 * @param timezone - IANA timezone for display. Defaults to DEFAULT_TIMEZONE.
 */
const formatEvent = (
  event: CalendarEvent,
  timezone: string = DEFAULT_TIMEZONE,
): string => {
  const startStr = formatDate(event.start, timezone);
  const endStr = formatDate(event.end, timezone);

  let timeRange: string;
  if (startStr && endStr) {
    timeRange = startStr === endStr ? startStr : `${startStr} to ${endStr}`;
  } else if (startStr) {
    timeRange = startStr;
  } else if (endStr) {
    timeRange = endStr;
  } else {
    timeRange = 'No time';
  }

  const location = event.location ? ` at ${event.location}` : '';

  return `- ${event.title}: ${timeRange}${location}`;
};

/**
 * Format a list of events as a display string.
 * Returns emptyMessage if no events.
 *
 * @param events - Calendar events to format
 * @param emptyMessage - Message to return if no events
 * @param timezone - IANA timezone for display. Defaults to DEFAULT_TIMEZONE.
 */
const formatEventList = (
  events: CalendarEvent[],
  emptyMessage: string = '',
  timezone: string = DEFAULT_TIMEZONE,
): string => {
  if (events.length === 0) return emptyMessage;
  return events.map((e) => formatEvent(e, timezone)).join('\n');
};

/**
 * Format a Date as a localized datetime string.
 * Used for user-facing messages in MCP tool responses.
 *
 * @param date - Date to format
 * @param options - Formatting options including timezone, locale, and display preferences
 */
const formatDateTime = (
  date: Date,
  options: {
    timezone?: string;
    locale?: string;
    includeWeekday?: boolean;
    includeTime?: boolean;
  } = {},
): string => {
  const {
    timezone = DEFAULT_TIMEZONE,
    locale = DEFAULT_LOCALE,
    includeWeekday = true,
    includeTime = true,
  } = options;

  const dt = DateTime.fromJSDate(date).setZone(timezone).setLocale(locale);

  // Build format string based on options
  let format = includeWeekday ? 'cccc d.M.yyyy' : 'd.M.yyyy';
  if (includeTime) {
    format += ' HH:mm';
  }

  return dt.toFormat(format);
};

/**
 * Format a time-only string from a Date.
 *
 * @param date - Date to extract time from
 * @param timezone - IANA timezone for display. Defaults to DEFAULT_TIMEZONE.
 */
const formatTime = (
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): string => {
  return DateTime.fromJSDate(date).setZone(timezone).toFormat('HH:mm');
};

export { formatEvent, formatEventList, formatDateTime, formatTime, formatDate };
