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
} from '@/utils/relativeDateCalculator';
import {
  formatEventList,
  formatDateTime,
  formatTime,
} from '@/utils/eventFormatting';
import { relativeTimeInputSchema, DEFAULT_TIMEZONE } from '@/utils/weekday';
import {
  CREATE_EVENT_DESCRIPTION,
  GET_EVENTS_IN_TIME_SLOT_DESCRIPTION,
} from '@/utils/relativeDateRules';

// ------------------- Type Definitions -------------------
/** Input type for createEvent tool */
type CreateEventInput = z.infer<typeof createEventInputSchema>;

/** Input type for getEventsInTimeSlot tool */
type TimeSlotInput = z.infer<typeof timeSlotInputSchema>;

// Build schemas with proper typing
const createEventInputSchema = z.object(relativeTimeInputSchema).extend({
  title: z.string().describe('Short title of the event'),
  description: z.string().optional().describe('Optional detailed description'),
  location: z.string().optional().describe('Optional location of the event'),
});

const timeSlotInputSchema = z.object(relativeTimeInputSchema);

// ------------------- MCP Server -------------------
const mcpServer = new McpServer({ name: 'calendar-server', version: '1.0.0' });

// ------------------- MCP Tools -------------------
mcpServer.registerTool(
  'createEvent',
  {
    title: 'Create Event',
    description: CREATE_EVENT_DESCRIPTION,
    inputSchema: createEventInputSchema,
  },
  async (input: CreateEventInput) => {
    const {
      title,
      weekOffset,
      weekday,
      time,
      durationMinutes,
      description,
      location,
      timezone,
    } = input;

    try {
      // Calculate absolute dates in TypeScript - NOT by LLM
      // Use wall-clock time for correct timezone handling
      const effectiveTimezone = timezone ?? DEFAULT_TIMEZONE;
      const wallClockNow = getWallClockNow(effectiveTimezone);
      const startDate = calculateAbsoluteDateFromWallClock(wallClockNow, {
        weekOffset,
        weekday,
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
            text: `Successfully scheduled "${title}" for ${formatDateTime(eventStart, { timezone: effectiveTimezone })}`,
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

    const text =
      events.length === 0
        ? 'No events found.'
        : `Found ${events.length} event(s):\n${formatEventList(events)}`;

    return {
      content: [{ type: 'text', text }],
      structuredContent: { events },
    };
  },
);

mcpServer.registerTool(
  'getEventsInTimeSlot',
  {
    title: 'Get Events In Time Slot',
    description: GET_EVENTS_IN_TIME_SLOT_DESCRIPTION,
    inputSchema: timeSlotInputSchema,
  },
  async (input: TimeSlotInput) => {
    const { weekOffset, weekday, time, durationMinutes, timezone } = input;

    try {
      // Use wall-clock time for correct timezone handling
      const effectiveTimezone = timezone ?? DEFAULT_TIMEZONE;
      const wallClockNow = getWallClockNow(effectiveTimezone);
      const slotStart = calculateAbsoluteDateFromWallClock(wallClockNow, {
        weekOffset,
        weekday,
        time,
      });
      const slotEnd = calculateEndDate(slotStart, durationMinutes);

      const events = await getEventsInRange(slotStart, slotEnd);

      const slotStartStr = formatDateTime(slotStart, {
        timezone: effectiveTimezone,
      });
      const slotEndStr = formatTime(slotEnd, effectiveTimezone);

      const isFree = events.length === 0;
      const availabilityStatus = isFree
        ? 'AVAILABLE - This time slot is FREE, no events scheduled.'
        : `BUSY - This time slot is NOT FREE. Found ${events.length} event(s):`;
      const eventList = formatEventList(events, '', effectiveTimezone);

      return {
        content: [
          {
            type: 'text',
            text: `Time slot: ${slotStartStr} - ${slotEndStr}\n${availabilityStatus}${eventList ? '\n' + eventList : ''}`,
          },
        ],
        structuredContent: {
          events,
          isFree,
          slot: {
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            timezone: effectiveTimezone,
          },
        },
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
      };
    }
  },
);

export { mcpServer };
