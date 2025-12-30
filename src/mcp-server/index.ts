import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createEvent, listEvents } from '@/calDav/calendarClient';

// ------------------- MCP Server -------------------
const mcpServer = new McpServer({ name: 'calendar-server', version: '1.0.0' });

// ------------------- MCP Tools -------------------
mcpServer.registerTool(
  'createEvent',
  {
    title: 'Create Event',
    description:
      "Create a new calendar event. If the user doesn't specify an end time, default to 60 minutes after the start time.",
    inputSchema: z.object({
      title: z.string().describe('Short title of the event'),
      start: z
        .string()
        .describe(
          'ISO 8601 start time in Local Time (e.g. 2025-01-01T17:00:00). Do NOT convert to UTC. Do NOT add Z or offset.',
        ),
      end: z
        .string()
        .describe(
          'ISO 8601 end time in Local Time (e.g. 2025-01-01T18:00:00). Do NOT convert to UTC. Do NOT add Z or offset.',
        ),
      description: z
        .string()
        .optional()
        .describe('Optional detailed description'),
      location: z
        .string()
        .optional()
        .describe('Optional location of the event'),
    }),
  },
  async ({ title, start, end, description, location }) => {
    try {
      console.log(`[createEvent] Received start: ${start}, end: ${end}`);

      // Helper to parse date as local time to avoid timezone shifts
      const parseAsLocal = (dateStr: string) => {
        const localStr = dateStr.replace(/(Z|[+-]\d{2}:?\d{2})$/, '');
        return new Date(localStr);
      };

      const startDate = parseAsLocal(start);
      if (Number.isNaN(startDate.getTime())) {
        throw new Error(
          'Invalid "start" datetime. Expected an ISO 8601 string (e.g., 2025-12-29T12:00:00).',
        );
      }

      const endDate = parseAsLocal(end);
      if (Number.isNaN(endDate.getTime())) {
        throw new Error(
          'Invalid "end" datetime. Expected an ISO 8601 string (e.g., 2025-12-29T13:00:00).',
        );
      }

      // Nyt parametrit tulevat suoraan tekoälyltä valmiiksi jäsenneltynä!
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
            text: `Successfully scheduled "${title}" for ${eventStart.toLocaleString()}`,
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
    description: 'List all events from local CalDAV',
    inputSchema: z.object({}),
    outputSchema: z.object({ events: z.array(z.any()) }),
  },
  async () => {
    const events = await listEvents();
    return {
      content: [{ type: 'text', text: `Found ${events.length} events.` }],
      structuredContent: { events },
    };
  },
);

export { mcpServer };
