import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createEvent,
  listEvents,
  getEventsInRange,
} from '@/calDav/calendarClient';
import { parseCalendarObjects } from '@/utils/calendar-events';
import {
  calculateAbsoluteDateFromWallClock,
  calculateEndDate,
  getWallClockNow,
  type Weekday,
} from '@/utils/relativeDateCalculator';
import {
  formatEventList,
  formatDateTime,
  formatTime,
} from '@/utils/eventFormatting';
import { weekdaySchema, DEFAULT_TIMEZONE } from '@/utils/weekday';

// ------------------- MCP Server -------------------
const mcpServer = new McpServer({ name: 'calendar-server', version: '1.0.0' });

// ------------------- MCP Tools -------------------
mcpServer.registerTool(
  'createEvent',
  {
    title: 'Create Event',
    description: `Create a new calendar event using RELATIVE date specification.
IMPORTANT: Do NOT compute absolute dates. Provide relative date info only.
- weekOffset: 0 = this week, 1 = next week, 2 = week after next, etc.
- weekday: The target day of the week (monday-sunday)
- time: Time in HH:mm format (24-hour)
- durationMinutes: Optional duration, defaults to 60 minutes

Examples:
- "next Monday" = weekOffset: 1, weekday: "monday"
- "this Friday" = weekOffset: 0, weekday: "friday"
- "two weeks from now on Tuesday" = weekOffset: 2, weekday: "tuesday"`,
    inputSchema: z.object({
      title: z.string().describe('Short title of the event'),
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
        .describe('Time in HH:mm format (24-hour), e.g., "15:00"'),
      durationMinutes: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Event duration in minutes. Defaults to 60 if not specified'),
      description: z
        .string()
        .optional()
        .describe('Optional detailed description'),
      location: z
        .string()
        .optional()
        .describe('Optional location of the event'),
      timezone: z
        .string()
        .optional()
        .describe(
          'IANA timezone (e.g., "Europe/Helsinki"). Defaults to Europe/Helsinki if not specified.',
        ),
    }),
  },
  async ({
    title,
    weekOffset,
    weekday,
    time,
    durationMinutes,
    description,
    location,
    timezone,
  }) => {
    try {
      // Calculate absolute dates in TypeScript - NOT by LLM
      // Use wall-clock time for correct timezone handling
      const wallClockNow = getWallClockNow(timezone ?? DEFAULT_TIMEZONE);
      const startDate = calculateAbsoluteDateFromWallClock(wallClockNow, {
        weekOffset,
        weekday: weekday as Weekday,
        time,
      });
      const endDate = calculateEndDate(startDate, durationMinutes);

      const { start: eventStart } = await createEvent({
        title,
        start: startDate,
        end: endDate,
        description,
        location,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Successfully scheduled "${title}" for ${formatDateTime(eventStart)} (${weekday})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
      };
    }
  },
);

mcpServer.registerTool(
  'listEvents',
  {
    title: 'List Events',
    description:
      'List all events from local CalDAV calendar. Returns parsed event data including title, start/end times, location, and description.',
    inputSchema: z.object({}),
  },
  async () => {
    const rawEvents = await listEvents();
    const events = parseCalendarObjects(rawEvents);
    const eventList = formatEventList(events, 'No events found.');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${events.length} events:\n${eventList}`,
        },
      ],
      structuredContent: { events },
    };
  },
);

mcpServer.registerTool(
  'getEventsInTimeSlot',
  {
    title: 'Get Events In Time Slot',
    description: `Get all events within a specific time slot.
Use this tool to check what events exist in a given time range.
Provide relative date parameters to specify the time slot.`,
    inputSchema: z.object({
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
        .describe('Start time in HH:mm format (24-hour), e.g., "15:00"'),
      durationMinutes: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Duration in minutes. Defaults to 60'),
      timezone: z
        .string()
        .optional()
        .describe(
          'IANA timezone (e.g., "Europe/Helsinki"). Defaults to Europe/Helsinki if not specified.',
        ),
    }),
  },
  async ({ weekOffset, weekday, time, durationMinutes, timezone }) => {
    try {
      // Use wall-clock time for correct timezone handling
      const wallClockNow = getWallClockNow(timezone ?? DEFAULT_TIMEZONE);
      const slotStart = calculateAbsoluteDateFromWallClock(wallClockNow, {
        weekOffset,
        weekday: weekday as Weekday,
        time,
      });
      const slotEnd = calculateEndDate(slotStart, durationMinutes);

      const events = await getEventsInRange(slotStart, slotEnd);

      const slotStartStr = formatDateTime(slotStart);
      const slotEndStr = formatTime(slotEnd);

      const isFree = events.length === 0;
      const availabilityStatus = isFree
        ? 'AVAILABLE - This time slot is FREE, no events scheduled.'
        : `BUSY - This time slot is NOT FREE. Found ${events.length} event(s):`;
      const eventList = formatEventList(events);

      return {
        content: [
          {
            type: 'text',
            text: `Time slot: ${slotStartStr} - ${slotEndStr}\n${availabilityStatus}${eventList ? '\n' + eventList : ''}`,
          },
        ],
        structuredContent: { events, isFree },
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
      };
    }
  },
);

export { mcpServer };
