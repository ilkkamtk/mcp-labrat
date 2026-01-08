import { z } from 'zod';
import { DateTime } from 'luxon';

/**
 * Shared weekday definitions.
 * Single source of truth for weekday types and mappings.
 * Uses ISO-8601 week rules (Monday = 1, Sunday = 7).
 */

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** All weekday values as a readonly array */
export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** Zod schema for weekday validation */
export const weekdaySchema = z.enum(WEEKDAYS);

/** ISO-8601 weekday numbers: Monday = 1, Sunday = 7 */
export const WEEKDAY_TO_ISO: Record<Weekday, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

export const ISO_TO_WEEKDAY: Record<number, Weekday> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  7: 'sunday',
};

/** Default timezone used when none is specified */
export const DEFAULT_TIMEZONE = 'Europe/Helsinki';

/**
 * Zod schema that validates a required IANA timezone string.
 * Returns 'Invalid timezone' error for invalid identifiers.
 */
export const timezoneSchema = z
  .string()
  .refine((tz) => DateTime.local().setZone(tz).isValid, {
    message:
      'Invalid timezone. Expected a valid IANA timezone identifier, e.g. "Europe/Helsinki".',
  });

/**
 * Zod schema that validates an optional IANA timezone string.
 * Used in MCP tool inputs where timezone defaults to DEFAULT_TIMEZONE.
 */
export const optionalTimezoneSchema = z
  .string()
  .optional()
  .refine((tz) => !tz || DateTime.local().setZone(tz).isValid, {
    message:
      'Invalid timezone. Expected a valid IANA timezone identifier, e.g. "Europe/Helsinki".',
  });

/**
 * Shared Zod schema for relative time input fields.
 * Used by createEvent and getEventsInTimeSlot MCP tools.
 */
export const relativeTimeInputSchema = {
  weekOffset: z
    .number()
    .int()
    .describe(
      'Week offset from current week. 0 = this week, 1 = next week, -1 = last week, etc.',
    ),
  weekday: weekdaySchema.describe(
    'Target weekday (monday, tuesday, wednesday, thursday, friday, saturday, sunday)',
  ),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .refine(
      (time) => {
        const [hour, minute] = time.split(':').map(Number);
        return hour >= 0 && hour < 24 && minute >= 0 && minute < 60;
      },
      {
        message:
          'Invalid time value. Hour must be 00-23 and minute must be 00-59.',
      },
    )
    .describe('Time in HH:mm format (24-hour), e.g., "15:00"'),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Duration in minutes. Defaults to 60 if not specified'),
  timezone: optionalTimezoneSchema.describe(
    'IANA timezone (e.g., "Europe/Helsinki"). Defaults to Europe/Helsinki if not specified.',
  ),
};
