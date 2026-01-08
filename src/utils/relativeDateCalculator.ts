/**
 * Relative date calculation utility.
 * Handles conversion from LLM-provided relative date info to absolute dates.
 * Uses ISO-8601 week rules (Monday = 1, Sunday = 7).
 *
 * This module uses Luxon DateTime as the wall-clock abstraction.
 * A DateTime in a specific zone represents "what time it is on the clock"
 * independent of the server's system timezone.
 */

import { DateTime } from 'luxon';
import {
  type Weekday,
  WEEKDAY_TO_ISO,
  ISO_TO_WEEKDAY,
  DEFAULT_TIMEZONE,
} from '@/utils/weekday';

export type { Weekday };

export type RelativeDateInput = {
  weekOffset: number; // 0 = this week, 1 = next week, -1 = last week, etc.
  weekday: Weekday;
  time: string; // "HH:mm" format
};

/**
 * Parse time string in HH:mm format.
 * @returns Parsed hours and minutes, or null if invalid format
 */
const parseHHmm = (time: string): { hours: number; minutes: number } | null => {
  const [h, m] = time.split(':');
  const hours = Number(h);
  const minutes = Number(m);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return { hours, minutes };
};

/**
 * Resolve weekday string to ISO weekday number.
 * @throws Error if weekday is invalid
 */
const resolveTargetISOWeekday = (weekday: Weekday): number => {
  const isoWeekday = WEEKDAY_TO_ISO[weekday];
  if (!isoWeekday) {
    throw new Error(`Invalid weekday: "${weekday}".`);
  }
  return isoWeekday;
};

/**
 * Get current wall-clock time in a specific timezone.
 * Returns a Luxon DateTime in the specified zone.
 *
 * @param timezone - IANA timezone string (e.g., 'Europe/Helsinki'). Defaults to DEFAULT_TIMEZONE.
 * @throws Error if timezone is invalid
 */
export const getWallClockNow = (
  timezone: string = DEFAULT_TIMEZONE,
): DateTime => {
  const dt = DateTime.now().setZone(timezone);

  if (!dt.isValid) {
    throw new Error(
      `Invalid timezone: "${timezone}". Reason: ${dt.invalidReason}`,
    );
  }

  return dt;
};

/**
 * Convert a wall-clock DateTime to a UTC JS Date.
 *
 * @param wallClock - Luxon DateTime in the target timezone
 * @returns Date representing the correct UTC instant
 * @throws Error if the DateTime is invalid
 */
export const wallClockToUTC = (wallClock: DateTime): Date => {
  if (!wallClock.isValid) {
    throw new Error(
      `Invalid wall-clock DateTime: ${wallClock.invalidReason ?? 'unknown reason'}`,
    );
  }

  return wallClock.toUTC().toJSDate();
};

/**
 * Calculate absolute date from relative date input.
 * Works with Luxon DateTime internally and returns a proper UTC Date.
 *
 * @param wallClockNow - The reference wall-clock time (from getWallClockNow)
 * @param input - Relative date specification from LLM
 * @returns Calculated absolute Date representing the correct UTC instant
 */
export const calculateAbsoluteDateFromWallClock = (
  wallClockNow: DateTime,
  input: RelativeDateInput,
): Date => {
  const { weekOffset, weekday, time } = input;

  // Validate and parse time
  const parsedTime = parseHHmm(time);
  if (!parsedTime) {
    throw new Error(
      `Invalid time format: "${time}". Expected "HH:mm" (e.g., "15:00").`,
    );
  }
  const { hours, minutes } = parsedTime;

  // Get target ISO weekday (1-7)
  const targetISOWeekday = resolveTargetISOWeekday(weekday);

  // Luxon's weekday property is already ISO (1=Monday, 7=Sunday)
  const currentISOWeekday = wallClockNow.weekday;

  // Calculate days to target weekday within the same week
  const daysToTargetInWeek = targetISOWeekday - currentISOWeekday;

  // Calculate total days offset
  const totalDaysOffset = weekOffset * 7 + daysToTargetInWeek;

  // Calculate the target DateTime using Luxon's arithmetic (stays in same zone)
  const targetWallClock = wallClockNow
    .plus({ days: totalDaysOffset })
    .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

  return wallClockToUTC(targetWallClock);
};

/**
 * Calculate absolute date from relative date input.
 * @deprecated Use calculateAbsoluteDateFromWallClock() with getWallClockNow() for correct timezone handling.
 *
 * @param now - The reference date (typically current date/time)
 * @param input - Relative date specification from LLM
 * @param timezone - Optional timezone for the calculation
 * @returns Calculated absolute Date
 */
export const calculateAbsoluteDate = (
  now: Date,
  input: RelativeDateInput,
  timezone: string = DEFAULT_TIMEZONE,
): Date => {
  const wallClockNow = DateTime.fromJSDate(now).setZone(timezone);
  return calculateAbsoluteDateFromWallClock(wallClockNow, input);
};

/**
 * Calculate end date based on start date and optional duration.
 * Default duration is 60 minutes.
 */
export const calculateEndDate = (
  startDate: Date,
  durationMinutes: number = 60,
): Date => {
  return DateTime.fromJSDate(startDate)
    .plus({ minutes: durationMinutes })
    .toJSDate();
};

/**
 * Get current date info for the system prompt.
 * Returns human-readable info to help LLM understand the current context.
 * @param timezone - IANA timezone string. Defaults to DEFAULT_TIMEZONE.
 */
export const getCurrentDateInfo = (
  timezone: string = DEFAULT_TIMEZONE,
): string => {
  const wallClock = getWallClockNow(timezone);
  const isoWeekday = wallClock.weekday;
  const weekdayName = ISO_TO_WEEKDAY[isoWeekday];

  const dateStr = wallClock.toFormat('yyyy-MM-dd');
  const timeStr = wallClock.toFormat('HH:mm');

  return (
    `Current date: ${dateStr} (${weekdayName}), ` +
    `Current time: ${timeStr}, ` +
    `Timezone: ${timezone}, ` +
    `ISO weekday: ${isoWeekday} (1=Monday, 7=Sunday)`
  );
};
