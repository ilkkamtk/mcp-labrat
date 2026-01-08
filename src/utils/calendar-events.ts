import { icsToJson } from '@/utils/icsToJson';

/**
 * Calendar event data model with raw Date objects.
 * Formatting is done at the presentation layer (MCP server).
 */
export type CalendarEvent = {
  title: string;
  start: Date | null;
  end: Date | null;
  location: string | null;
  description: string | null;
};

/**
 * Parse iCal date string to Date object.
 * Handles both UTC (ending with Z) and floating local time formats.
 */
const parseIcsDate = (icalDate?: string): Date | null => {
  if (!icalDate) return null;

  const isUTC = icalDate.endsWith('Z');

  const match = icalDate.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?Z?$/,
  );
  if (!match) return null;

  // Include seconds to preserve precision (defaults to '0' if not captured)
  const [, year, month, day, hour, minute, second] = match;

  if (isUTC && hour && minute) {
    return new Date(
      Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second ?? '0'),
      ),
    );
  }

  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    hour ? parseInt(hour) : 0,
    minute ? parseInt(minute) : 0,
    second ? parseInt(second) : 0,
  );
};

/**
 * Map raw ICS string to CalendarEvent array.
 * Centralizes iCal → CalendarEvent transformation.
 */
export const mapIcsToCalendarEvents = (ics: string): CalendarEvent[] => {
  const parsed = icsToJson(ics);
  return parsed.map((evt) => ({
    title: evt.summary || 'Untitled',
    start: parseIcsDate(evt.startDate),
    end: parseIcsDate(evt.endDate),
    location: evt.location || null,
    description: evt.description || null,
  }));
};

/**
 * Parse raw CalDAV calendar objects into CalendarEvent array.
 * Shared helper to ensure consistent parsing across all event retrieval methods.
 */
export const parseCalendarObjects = (
  calendarObjects: Array<{ data?: string }>,
): CalendarEvent[] => {
  return calendarObjects
    .filter((obj) => obj.data)
    .flatMap((obj) => mapIcsToCalendarEvents(obj.data!));
};
