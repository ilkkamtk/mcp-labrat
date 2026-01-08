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
 * Get current wall-clock time in a specific timezone.
 * Returns a WallClockTime object that can be used for relative calculations
 * or converted to a UTC instant using wallClockToUTC().
 *
 * @param timezone - IANA timezone string (e.g., 'Europe/Helsinki'). Defaults to DEFAULT_TIMEZONE.
 */
export const getWallClockNow = (
  timezone: string = DEFAULT_TIMEZONE,
): WallClockTime => {
  const nowStr = new Date().toLocaleString('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  // Parse "YYYY-MM-DD, HH:mm:ss" format
  const [datePart, timePart] = nowStr.split(', ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);

  return { year, month, day, hour, minute, second, timezone };
};

/**
 * Convert a wall-clock time in a specific timezone to a proper UTC Date.
 * This correctly handles timezone offsets so the Date represents the actual instant.
 *
 * @param wallClock - Wall-clock time to convert
 * @returns Date representing the correct UTC instant
 */
export const wallClockToUTC = (wallClock: WallClockTime): Date => {
  // Create a date string in ISO format and use the timezone to get the correct UTC instant
  // We format as if it were UTC, then find the offset by comparing with the actual timezone
  const isoString = `${wallClock.year}-${String(wallClock.month).padStart(2, '0')}-${String(wallClock.day).padStart(2, '0')}T${String(wallClock.hour).padStart(2, '0')}:${String(wallClock.minute).padStart(2, '0')}:${String(wallClock.second).padStart(2, '0')}`;

  // Create a date assuming UTC
  const asUTC = new Date(isoString + 'Z');

  // Get what time that UTC instant represents in the target timezone
  const inTargetTz = new Date(
    asUTC.toLocaleString('en-US', { timeZone: wallClock.timezone }),
  );

  // Calculate the offset in milliseconds
  const offsetMs = inTargetTz.getTime() - asUTC.getTime();

  // The correct UTC instant is the wall-clock time minus the offset
  return new Date(asUTC.getTime() - offsetMs);
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
  const jsDay = localDate.getDay();
  return jsDay === 0 ? 7 : jsDay;
};

/**
 * Get ISO weekday (1-7, Monday-Sunday) from a Date object.
 * JavaScript's getDay() returns 0-6 (Sunday-Saturday), so we convert.
 * @deprecated Use getISOWeekdayFromWallClock() for wall-clock time calculations.
 */
const getISOWeekday = (date: Date): number => {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
};

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

  // Validate time format
  const timeMatch = time.match(/^(\d{2}):(\d{2})$/);
  if (!timeMatch) {
    throw new Error(
      `Invalid time format: "${time}". Expected "HH:mm" (e.g., "15:00").`,
    );
  }

  const [, hoursStr, minutesStr] = timeMatch;
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time values: "${time}".`);
  }

  // Get target ISO weekday (1-7)
  const targetISOWeekday = WEEKDAY_TO_ISO[weekday];
  if (!targetISOWeekday) {
    throw new Error(`Invalid weekday: "${weekday}".`);
  }

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

  // Validate time format
  const timeMatch = time.match(/^(\d{2}):(\d{2})$/);
  if (!timeMatch) {
    throw new Error(
      `Invalid time format: "${time}". Expected "HH:mm" (e.g., "15:00").`,
    );
  }

  const [, hoursStr, minutesStr] = timeMatch;
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time values: "${time}".`);
  }

  // Get target ISO weekday (1-7)
  const targetISOWeekday = WEEKDAY_TO_ISO[weekday];
  if (!targetISOWeekday) {
    throw new Error(`Invalid weekday: "${weekday}".`);
  }

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
