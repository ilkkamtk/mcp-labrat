import type { CalendarEvent } from '@/utils/calendar-events';

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Format a Date object as a readable string with weekday.
 * Output: "YYYY-MM-DD (Weekday) HH:mm" or "YYYY-MM-DD (Weekday)" for midnight.
 */
const formatDate = (date: Date | null): string | null => {
  if (!date) return null;

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const weekday = WEEKDAY_NAMES[date.getDay()];
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

export { formatEvent, formatEventList };
