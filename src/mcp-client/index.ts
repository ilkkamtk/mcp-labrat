import fetchData from '@/utils/fetchData';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  ChatCompletion,
  ChatCompletionMessageParam,
} from 'openai/resources/index';
import { getCurrentDateInfo } from '@/utils/relativeDateCalculator';
import { DEFAULT_TIMEZONE } from '@/utils/weekday';

type RunPromptResponse = {
  answer: string;
  toolCalls: number;
};

const MAX_ROUNDS = 10;

export const runPromptWithMcpServer = async (
  prompt: string,
  timezone: string = DEFAULT_TIMEZONE,
): Promise<RunPromptResponse> => {
  const mcpServerUrl = process.env.MCP_SERVER_URL;
  if (!mcpServerUrl) {
    throw new Error('MCP_SERVER_URL environment variable is not set');
  }
  const openAiApiUrl = process.env.OPENAI_API_URL;
  if (!openAiApiUrl) {
    throw new Error('OPENAI_API_URL environment variable is not set');
  }

  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl));
  const mcpClient = new Client(
    { name: 'mcp-client', version: '1.0.0' },
    { capabilities: {} },
  );
  await mcpClient.connect(transport);

  const dateInfo = getCurrentDateInfo(timezone);

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `
You are a specialized assistant with access to specific MCP tools.

${dateInfo}

CRITICAL DATE RULES - READ CAREFULLY:
1. You must NEVER compute or output absolute dates (like 2026-01-12 or ISO timestamps).
2. For calendar events, you MUST provide ONLY relative date information:
   - weekOffset: number (0 = this week, 1 = next week, 2 = two weeks from now, etc.)
   - weekday: string (monday, tuesday, wednesday, thursday, friday, saturday, sunday)
   - time: string in HH:mm format (24-hour)

3. Week definition (ISO-8601):
   - Week starts on MONDAY (weekday 1)
   - Week ends on SUNDAY (weekday 7)
   - "This week" means the current Mon-Sun period
   - "Next week" means the NEXT Mon-Sun period (weekOffset: 1)

4. Special case - "tomorrow":
   - Calculate weekOffset and weekday based on what day tomorrow actually is
   - If today is Thursday, tomorrow is Friday → weekOffset: 0, weekday: "friday"
   - If today is Saturday, tomorrow is Sunday → weekOffset: 0, weekday: "sunday"
   - If today is Sunday, tomorrow is Monday → weekOffset: 1, weekday: "monday"

5. Examples of correct interpretation:
   - "next Monday" → weekOffset: 1, weekday: "monday"
   - "next Friday" → weekOffset: 1, weekday: "friday"
   - "this Friday" → weekOffset: 0, weekday: "friday"
   - "two weeks from now on Tuesday" → weekOffset: 2, weekday: "tuesday"
   - "tomorrow" when today is Thursday → weekOffset: 0, weekday: "friday"

6. The server will calculate the actual date. Your job is ONLY to extract the relative intent.

WORKFLOW FOR CREATING EVENTS WITH AVAILABILITY CHECK:
When the user asks to create an event "if the time is free" or similar:
1. FIRST call getEventsInTimeSlot with the relative date parameters
2. If no events are returned, the time slot is free - call createEvent
3. If events are returned, inform the user about the existing events

Do NOT try to interpret dates from listEvents output. Use getEventsInTimeSlot instead.

ABSOLUTE RULE:
- Every user request MUST be handled using one or more of the provided tools.
- If a request cannot be fulfilled by using the tools, you MUST refuse.

Tool usage rules:
1. First, decide whether any tool can be used for the request.
2. If no tool applies, refuse the request.
3. If a tool is used, base the answer strictly on its output.
4. Do not add knowledge not present in tool results.

Internal reasoning:
- Think step by step about tool applicability.
- Do NOT reveal your reasoning.
- When determining weekOffset, count from current week (0) to target week.

Refusal format:
- One short sentence.
- No explanations.
`.trim(),
    },
    { role: 'user', content: prompt },
  ];

  try {
    const { tools } = await mcpClient.listTools();
    const openaiTools = tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters:
          typeof tool.inputSchema === 'object' && tool.inputSchema !== null
            ? tool.inputSchema
            : { type: 'object', properties: {} },
      },
    }));

    let toolCallsCount = 0;

    for (let i = 0; i < MAX_ROUNDS; i++) {
      const completion = await fetchData<ChatCompletion>(
        `${openAiApiUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            messages,
            tools: openaiTools.length > 0 ? openaiTools : undefined,
            tool_choice: 'auto',
          }),
        },
      );

      const message = completion.choices[0]?.message;
      if (!message) throw new Error('No message returned from OpenAI');

      // Ensure message is properly formatted for history
      messages.push({
        role: message.role,
        content: message.content,
        tool_calls: message.tool_calls,
      });

      if (!message.tool_calls || message.tool_calls.length === 0) {
        const answer = message.content || '';

        return {
          answer,
          toolCalls: toolCallsCount,
        };
      }

      toolCallsCount += message.tool_calls.length;

      const toolResults = await Promise.all(
        message.tool_calls.map(async (call) => {
          if (call.type !== 'function') return null;

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(String(call.function.arguments));
          } catch (error) {
            return {
              role: 'tool',
              tool_call_id: call.id,
              content: `Error: Invalid JSON arguments for tool ${call.function.name}: ${error instanceof Error ? error.message : String(error)}`,
            } as ChatCompletionMessageParam;
          }

          try {
            const result = await mcpClient.callTool({
              name: call.function.name,
              arguments: args,
            });

            const content = Array.isArray(result.content) ? result.content : [];

            const textParts = content
              .filter(
                (item): item is { type: 'text'; text: string } =>
                  item.type === 'text',
              )
              .map((item) => item.text);

            if (result.structuredContent) {
              textParts.push(JSON.stringify(result.structuredContent));
            }

            const finalContent = textParts.join('\n') || JSON.stringify(result);

            return {
              role: 'tool',
              tool_call_id: call.id,
              content: finalContent,
            } as ChatCompletionMessageParam;
          } catch (error) {
            return {
              role: 'tool',
              tool_call_id: call.id,
              content: `Error executing tool ${call.function.name}: ${error instanceof Error ? error.message : String(error)}`,
            } as ChatCompletionMessageParam;
          }
        }),
      );

      messages.push(...toolResults.filter((result) => result !== null));
    }
    throw new Error(
      `Max tool rounds reached (${MAX_ROUNDS}). The model kept requesting tools.`,
    );
  } finally {
    await transport.close();
  }
};
