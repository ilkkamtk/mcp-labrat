import type { CalendarEvent } from '@/utils/calendar-events';
import { JS_WEEKDAY_NAMES } from '@/utils/weekday';

/**
 * Format a Date object as a readable string with weekday.
 * Output: "YYYY-MM-DD (Weekday) HH:mm" or "YYYY-MM-DD (Weekday)" for midnight.
 */
const formatDate = (date: Date | null): string | null => {
  if (!date) return null;

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const weekday = JS_WEEKDAY_NAMES[date.getDay()];
  const hour = date.getHours();
  const minute = date.getMinutes();

  if (hour === 0 && minute === 0) {
    return `${year}-${month}-${day} (${weekday})`;
  }

  const hourStr = hour.toString().padStart(2, '0');
  const minuteStr = minute.toString().padStart(2, '0');
  return `${year}-${month}-${day} (${weekday}) ${hourStr}:${minuteStr}`;
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

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  };

  if (includeWeekday) {
    formatOptions.weekday = 'long';
  }

  if (includeTime) {
    formatOptions.hour = '2-digit';
    formatOptions.minute = '2-digit';
  }

  return date.toLocaleString(locale, formatOptions);
};

/**
 * Format a time-only string from a Date.
 */
const formatTime = (date: Date, locale: string = 'fi-FI'): string => {
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export { formatEvent, formatEventList, formatDateTime, formatTime, formatDate };
