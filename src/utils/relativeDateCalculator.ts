/**
 * Relative date calculation utility.
 * Handles conversion from LLM-provided relative date info to absolute dates.
 * Uses ISO-8601 week rules (Monday = 1, Sunday = 7).
 *
 * IMPORTANT: This module distinguishes between:
 * - Wall-clock time: Local time in a specific timezone (e.g., "14:00 in Helsinki")
 * - UTC instant: A specific moment in time, independent of timezone
 *
 * For relative calculations, we use wall-clock representations.
 * For storage/CalDAV, we convert to proper UTC instants using wallClockToUTC().
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
 * Wall-clock time representation.
 * Represents a date/time in a specific timezone without being tied to the server's timezone.
 */
export type WallClockTime = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  timezone: string;
};

/**
 * Parse time string in HH:mm format.
 * @returns Parsed hours and minutes, or null if invalid format
 */
const parseHHmm = (time: string): { hours: number; minutes: number } | null => {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
};

/**
 * Convert JavaScript's day (0=Sunday) to ISO weekday (1=Monday, 7=Sunday).
 */
const jsDayToISOWeekday = (jsDay: number): number => (jsDay === 0 ? 7 : jsDay);

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
 * Get current wall-clock time in a specific timezone using luxon.
 * Returns a WallClockTime object that can be used for relative calculations
 * or converted to a UTC instant using wallClockToUTC().
 *
 * @param timezone - IANA timezone string (e.g., 'Europe/Helsinki'). Defaults to DEFAULT_TIMEZONE.
 * @throws Error if timezone is invalid
 */
export const getWallClockNow = (
  timezone: string = DEFAULT_TIMEZONE,
): WallClockTime => {
  const dt = DateTime.now().setZone(timezone);

  if (!dt.isValid) {
    throw new Error(`Invalid timezone: "${timezone}".`);
  }

  return {
    year: dt.year,
    month: dt.month,
    day: dt.day,
    hour: dt.hour,
    minute: dt.minute,
    second: dt.second,
    timezone,
  };
};

/**
 * Convert a wall-clock time in a specific timezone to a proper UTC Date using luxon.
 * This correctly handles timezone offsets and DST transitions.
 *
 * @param wallClock - Wall-clock time to convert
 * @returns Date representing the correct UTC instant
 * @throws Error if the wall-clock time is invalid
 */
export const wallClockToUTC = (wallClock: WallClockTime): Date => {
  const dt = DateTime.fromObject(
    {
      year: wallClock.year,
      month: wallClock.month,
      day: wallClock.day,
      hour: wallClock.hour,
      minute: wallClock.minute,
      second: wallClock.second,
    },
    { zone: wallClock.timezone },
  );

  if (!dt.isValid) {
    throw new Error(
      `Invalid wall-clock time: ${JSON.stringify(wallClock)}. Reason: ${dt.invalidReason}`,
    );
  }

  return dt.toJSDate();
};

/**
 * Get ISO weekday (1-7, Monday-Sunday) from a WallClockTime object.
 */
const getISOWeekdayFromWallClock = (wallClock: WallClockTime): number => {
  // Create a local Date just to get the weekday (timezone doesn't matter for weekday calculation
  // as long as we use the wall-clock values)
  const localDate = new Date(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
  );
  return jsDayToISOWeekday(localDate.getDay());
};

/**
 * Get ISO weekday (1-7, Monday-Sunday) from a Date object.
 * JavaScript's getDay() returns 0-6 (Sunday-Saturday), so we convert.
 * @deprecated Use getISOWeekdayFromWallClock() for wall-clock time calculations.
 */
const getISOWeekday = (date: Date): number => jsDayToISOWeekday(date.getDay());

/**
 * Calculate absolute date from relative date input.
 * Works with wall-clock time internally and returns a proper UTC Date.
 *
 * @param wallClockNow - The reference wall-clock time (from getWallClockNow)
 * @param input - Relative date specification from LLM
 * @returns Calculated absolute Date representing the correct UTC instant
 * @throws Error if the calculation produces an inconsistent result
 */
export const calculateAbsoluteDateFromWallClock = (
  wallClockNow: WallClockTime,
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

  // Get current ISO weekday (1-7) from wall-clock
  const currentISOWeekday = getISOWeekdayFromWallClock(wallClockNow);

  // Calculate days to target weekday within the same week
  const daysToTargetInWeek = targetISOWeekday - currentISOWeekday;

  // Calculate total days offset
  const totalDaysOffset = weekOffset * 7 + daysToTargetInWeek;

  // Calculate the target date using wall-clock arithmetic
  const targetDate = new Date(
    wallClockNow.year,
    wallClockNow.month - 1,
    wallClockNow.day + totalDaysOffset,
  );

  // Create the result wall-clock time
  const resultWallClock: WallClockTime = {
    year: targetDate.getFullYear(),
    month: targetDate.getMonth() + 1,
    day: targetDate.getDate(),
    hour: hours,
    minute: minutes,
    second: 0,
    timezone: wallClockNow.timezone,
  };

  // Verify the result matches the requested weekday
  const resultISOWeekday = getISOWeekdayFromWallClock(resultWallClock);
  if (resultISOWeekday !== targetISOWeekday) {
    throw new Error(
      `Date calculation inconsistency: expected ${weekday} (ISO ${targetISOWeekday}), ` +
        `but got ${ISO_TO_WEEKDAY[resultISOWeekday]} (ISO ${resultISOWeekday}). ` +
        `Input: weekOffset=${weekOffset}, weekday=${weekday}, time=${time}.`,
    );
  }

  // Convert to proper UTC Date
  return wallClockToUTC(resultWallClock);
};

/**
 * Calculate absolute date from relative date input.
 * @deprecated Use calculateAbsoluteDateFromWallClock() with getWallClockNow() for correct timezone handling.
 *
 * @param now - The reference date (typically current date/time)
 * @param input - Relative date specification from LLM
 * @returns Calculated absolute Date
 * @throws Error if the calculation produces an inconsistent result
 */
export const calculateAbsoluteDate = (
  now: Date,
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

  // Get current ISO weekday (1-7)
  const currentISOWeekday = getISOWeekday(now);

  // Calculate days to target weekday within the same week
  // If weekOffset is 0 and target is before current, we stay in the same week
  const daysToTargetInWeek = targetISOWeekday - currentISOWeekday;

  // Calculate total days offset
  // Each week offset adds/subtracts 7 days
  const totalDaysOffset = weekOffset * 7 + daysToTargetInWeek;

  // Create result date
  const result = new Date(now);
  result.setDate(result.getDate() + totalDaysOffset);
  result.setHours(hours, minutes, 0, 0);

  // Verify the result matches the requested weekday
  const resultISOWeekday = getISOWeekday(result);
  if (resultISOWeekday !== targetISOWeekday) {
    throw new Error(
      `Date calculation inconsistency: expected ${weekday} (ISO ${targetISOWeekday}), ` +
        `but got ${ISO_TO_WEEKDAY[resultISOWeekday]} (ISO ${resultISOWeekday}). ` +
        `Input: weekOffset=${weekOffset}, weekday=${weekday}, time=${time}. ` +
        `Reference date: ${now.toISOString()}.`,
    );
  }

  return result;
};

/**
 * Calculate end date based on start date and optional duration.
 * Default duration is 60 minutes.
 */
export const calculateEndDate = (
  startDate: Date,
  durationMinutes: number = 60,
): Date => {
  const endDate = new Date(startDate);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);
  return endDate;
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
  const isoWeekday = getISOWeekdayFromWallClock(wallClock);
  const weekdayName = ISO_TO_WEEKDAY[isoWeekday];

  const dateStr = `${wallClock.year}-${String(wallClock.month).padStart(2, '0')}-${String(wallClock.day).padStart(2, '0')}`;
  const timeStr = `${String(wallClock.hour).padStart(2, '0')}:${String(wallClock.minute).padStart(2, '0')}`;

  return (
    `Current date: ${dateStr} (${weekdayName}), ` +
    `Current time: ${timeStr}, ` +
    `Timezone: ${timezone}, ` +
    `ISO weekday: ${isoWeekday} (1=Monday, 7=Sunday)`
  );
};
