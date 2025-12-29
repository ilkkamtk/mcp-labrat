import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createEvent, listEvents } from '@/calDav/calendarClient';
import fetchData from '@/utils/fetchData';
import { ChatCompletion } from 'openai/resources';
import { ICalInput } from '@/utils/ical-lib';

// Helper to call your OpenAI Proxy
const parseWithOpenAI = async (
  command: string,
): Promise<Omit<ICalInput, 'uid' | 'domain'>> => {
  const proxyUrl = process.env.OPENAI_API_URL;
  if (!proxyUrl) {
    throw new Error('OPENAI_API_URL is not defined');
  }

  const prompt = `
    Extract event details from this command: "${command}"
    Current time is: ${new Date().toISOString()}
    If end time is not specified, assume a default duration of 60 minutes.

    If description or location are not specified, you can omit them.
    
    Return ONLY a JSON object with these fields:
    {
      "title": "string",
      "start": "ISO8601 string",
      "end": "ISO8601 string",
      "description": "string (optional)",
      "location": "string (optional)"
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

  const content = JSON.parse(data.choices[0].message.content);

  // check that content has required fields
  if (!content.title || !content.start || !content.end) {
    throw new Error('Invalid response from AI: missing required fields');
  }

  const output: Omit<ICalInput, 'uid' | 'domain'> = {
    title: content.title,
    start: new Date(content.start),
    end: new Date(content.end),
  };

  // Validate parsed dates to avoid passing Invalid Date to calendar / iCal generation
  if (
    Number.isNaN(output.start.getTime()) ||
    Number.isNaN(output.end.getTime())
  ) {
    throw new Error(
      'Invalid response from AI: start or end is not a valid date',
    );
  }

  if (content.description) {
    output.description = content.description;
  }
  if (content.location) {
    output.location = content.location;
  }

  return output;
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
      const { title, start, end } = await parseWithOpenAI(command);

      // 2. Use calendar client to create the event
      const { start: eventStart } = await createEvent({ title, start, end });

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
