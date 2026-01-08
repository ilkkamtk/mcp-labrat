import { z } from 'zod';

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

/** JavaScript weekday names (Sunday = 0) for display formatting */
export const JS_WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Default timezone used when none is specified */
export const DEFAULT_TIMEZONE = 'Europe/Helsinki';
