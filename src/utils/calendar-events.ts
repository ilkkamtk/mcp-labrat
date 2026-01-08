import { DateTime } from 'luxon';
import { icsToJson } from '@/utils/icsToJson';
import { DEFAULT_TIMEZONE } from '@/utils/weekday';

/**
 * Logger interface for ICS parsing warnings.
 * Allows callers to plug in structured logging if needed.
 */
export type IcsLogger = {
  warn: (message: string) => void;
};

/** Default logger uses console.warn */
const defaultLogger: IcsLogger = {
  warn: (message: string) => console.warn(message),
};

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
 * Parse iCal date string to Date object using luxon.
 * Handles both UTC (ending with Z) and floating local time formats.
 *
 * Note: TZID parameters and numeric offsets (e.g., +0200) are not currently
 * fully supported - the timezone/offset info is stripped and DEFAULT_TIMEZONE
 * is used for the resulting time. A warning is logged when this occurs.
 *
 * @param icalDate - The iCal date string to parse
 * @param logger - Optional logger for warnings. Defaults to console.warn.
 */
const parseIcsDate = (
  icalDate?: string,
  logger: IcsLogger = defaultLogger,
): Date | null => {
  if (!icalDate) return null;

  let dateStr = icalDate;
  let hasTzInfo = false;

  // Handle TZID format: "TZID=Europe/Helsinki:20250101T120000"
  // Strip the TZID prefix and use the date portion
  if (icalDate.includes('TZID=')) {
    const colonIndex = icalDate.indexOf(':');
    if (colonIndex !== -1) {
      dateStr = icalDate.substring(colonIndex + 1);
      hasTzInfo = true;
    }
  }

  // Handle numeric offset format: "20250101T120000+0200" or "20250101T120000-0500"
  // Strip the offset and parse the local time portion
  const offsetMatch = dateStr.match(/^(.+?)([+-]\d{4})$/);
  if (offsetMatch) {
    dateStr = offsetMatch[1];
    hasTzInfo = true;
  }

  if (hasTzInfo) {
    logger.warn(
      `[parseIcsDate] Date contains TZID or offset: "${icalDate}". ` +
        `Stripping timezone info and using DEFAULT_TIMEZONE. Full TZ support not implemented.`,
    );
  }

  const isUTC = dateStr.endsWith('Z');

  // Match iCal date format: YYYYMMDD or YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const match = dateStr.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?Z?$/,
  );
  if (!match) {
    logger.warn(
      `[parseIcsDate] Unable to parse date: "${icalDate}". Returning null.`,
    );
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;

  const dt = DateTime.fromObject(
    {
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
      hour: hour ? parseInt(hour) : 0,
      minute: minute ? parseInt(minute) : 0,
      second: second ? parseInt(second) : 0,
    },
    { zone: isUTC ? 'utc' : DEFAULT_TIMEZONE },
  );

  return dt.isValid ? dt.toJSDate() : null;
};

/**
 * Map raw ICS string to CalendarEvent array.
 * Centralizes iCal → CalendarEvent transformation.
 *
 * @param ics - Raw ICS string content
 * @param logger - Optional logger for parsing warnings. Defaults to console.warn.
 */
export const mapIcsToCalendarEvents = (
  ics: string,
  logger: IcsLogger = defaultLogger,
): CalendarEvent[] => {
  const parsed = icsToJson(ics);
  return parsed.map((evt) => ({
    title: evt.summary || 'Untitled',
    start: parseIcsDate(evt.startDate, logger),
    end: parseIcsDate(evt.endDate, logger),
    location: evt.location || null,
    description: evt.description || null,
  }));
};

/**
 * Parse raw CalDAV calendar objects into CalendarEvent array.
 * Shared helper to ensure consistent parsing across all event retrieval methods.
 *
 * @param calendarObjects - Raw CalDAV calendar objects with ICS data
 * @param logger - Optional logger for parsing warnings. Defaults to console.warn.
 */
export const parseCalendarObjects = (
  calendarObjects: Array<{ data?: string }>,
  logger: IcsLogger = defaultLogger,
): CalendarEvent[] => {
  return calendarObjects
    .filter((obj) => obj.data)
    .flatMap((obj) => mapIcsToCalendarEvents(obj.data!, logger));
};
