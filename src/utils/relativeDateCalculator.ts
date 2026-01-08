/**
 * Relative date calculation utility.
 * Handles conversion from LLM-provided relative date info to absolute dates.
 * Uses ISO-8601 week rules (Monday = 1, Sunday = 7).
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
 * Get current date/time in a specific timezone.
 * @param timezone - IANA timezone string (e.g., 'Europe/Helsinki'). Defaults to DEFAULT_TIMEZONE.
 */
export const getNow = (timezone: string = DEFAULT_TIMEZONE): Date => {
  // Get current time formatted in the target timezone
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
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
};

/**
 * Get ISO weekday (1-7, Monday-Sunday) from a Date object.
 * JavaScript's getDay() returns 0-6 (Sunday-Saturday), so we convert.
 */
const getISOWeekday = (date: Date): number => {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
};

/**
 * Calculate absolute date from relative date input.
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
  const now = getNow(timezone);
  const isoWeekday = getISOWeekday(now);
  const weekdayName = ISO_TO_WEEKDAY[isoWeekday];

  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    `Current date: ${dateStr} (${weekdayName}), ` +
    `Current time: ${timeStr}, ` +
    `Timezone: ${timezone}, ` +
    `ISO weekday: ${isoWeekday} (1=Monday, 7=Sunday)`
  );
};
