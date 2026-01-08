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
 * Handles UTC (ending with Z), floating local time, TZID parameters,
 * and numeric offsets (e.g., +0200).
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
  let timezone: string | null = null;
  let offsetMinutes: number | null = null;

  // Handle TZID format: "TZID=Europe/Helsinki:20250101T120000"
  // Extract and honor the specified timezone
  if (icalDate.includes('TZID=')) {
    const tzMatch = icalDate.match(/TZID=([^:]+):(.+)/);
    if (tzMatch) {
      const [, tz, date] = tzMatch;
      // Validate the timezone with luxon
      const testDt = DateTime.local().setZone(tz);
      if (testDt.isValid) {
        timezone = tz;
        dateStr = date;
      } else {
        logger.warn(
          `[parseIcsDate] Invalid TZID "${tz}" in "${icalDate}". Using DEFAULT_TIMEZONE.`,
        );
        dateStr = date;
      }
    }
  }

  // Handle numeric offset format: "20250101T120000+0200" or "20250101T120000-0500"
  // Parse the offset and convert to minutes
  const offsetMatch = dateStr.match(/^(.+?)([+-])(\d{2})(\d{2})$/);
  if (offsetMatch) {
    const [, date, sign, hours, minutes] = offsetMatch;
    dateStr = date;
    offsetMinutes =
      (parseInt(hours) * 60 + parseInt(minutes)) * (sign === '-' ? -1 : 1);
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

  // Determine the zone to use:
  // 1. If UTC suffix (Z), use UTC
  // 2. If TZID was specified and valid, use that timezone
  // 3. If numeric offset, use fixed offset zone
  // 4. Otherwise, use DEFAULT_TIMEZONE (floating time)
  let zone: string;
  if (isUTC) {
    zone = 'utc';
  } else if (timezone) {
    zone = timezone;
  } else if (offsetMinutes !== null) {
    zone = `UTC${offsetMinutes >= 0 ? '+' : ''}${Math.floor(offsetMinutes / 60)}:${String(Math.abs(offsetMinutes % 60)).padStart(2, '0')}`;
  } else {
    zone = DEFAULT_TIMEZONE;
  }

  const dt = DateTime.fromObject(
    {
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
      hour: hour ? parseInt(hour) : 0,
      minute: minute ? parseInt(minute) : 0,
      second: second ? parseInt(second) : 0,
    },
    { zone },
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
