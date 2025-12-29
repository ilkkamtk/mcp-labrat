import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAuthenticatedClient } from '@/calDav/calendarClient';
import fetchData from '@/utils/fetchData';
import { ChatCompletion } from 'openai/resources';

// Helper to call your OpenAI Proxy
const parseWithOpenAI = async (command: string) => {
  const proxyUrl = process.env.OPENAI_API_URL;
  if (!proxyUrl) {
    throw new Error('OPENAI_API_URL is not defined');
  }

  const prompt = `
    Extract event details from this command: "${command}"
    Current time is: ${new Date().toISOString()}
    
    Return ONLY a JSON object with these fields:
    {
      "title": "string",
      "startTime": "ISO8601 string",
      "duration": number (minutes, default 60)
    }
  `;

  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: 'Extract the event information.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  };

  const data = await fetchData<ChatCompletion>(
    proxyUrl + '/v1/chat/completions',
    options,
  );

  if (
    !data.choices ||
    data.choices.length === 0 ||
    !data.choices[0].message ||
    !data.choices[0].message.content
  ) {
    throw new Error('No choices returned from AI');
  }
  return JSON.parse(data.choices[0].message.content);
};

// ------------------- MCP Server -------------------
const mcpServer = new McpServer({ name: 'calendar-server', version: '1.0.0' });

// ------------------- MCP Tools -------------------
mcpServer.registerTool(
  'quickSchedule',
  {
    title: 'Quick Schedule',
    description:
      'Schedule an event using natural language (e.g., "lunch tomorrow at 11:30")',
    inputSchema: z.object({
      command: z.string(),
    }),
  },
  async ({ command }) => {
    try {
      // 1. Parse the natural language using OpenAI
      const { title, startTime, duration } = await parseWithOpenAI(command);

      // 2. Use existing logic to create the event
      const client = await getAuthenticatedClient();
      const calendars = await client.fetchCalendars();
      if (calendars.length === 0) {
        throw new Error('No calendars found for the user.');
      }
      const calendar = calendars[0];

      const start = new Date(startTime);
      const endTime = new Date(start.getTime() + duration * 60000);

      const eventId = Date.now();
      const icalEvent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:${eventId}@mcp-server
SUMMARY:${title}
DTSTART:${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${endTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
END:VEVENT
END:VCALENDAR`;

      await client.createCalendarObject({
        calendar,
        filename: `${eventId}.ics`,
        iCalString: icalEvent,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Successfully scheduled "${title}" for ${start.toLocaleString()}`,
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
    const client = await getAuthenticatedClient();
    const calendars = await client.fetchCalendars();
    const events = await client.fetchCalendarObjects({
      calendar: calendars[0],
    });
    return {
      content: [{ type: 'text', text: `Found ${events!.length} events.` }],
      structuredContent: { events },
    };
  },
);

export { mcpServer };
