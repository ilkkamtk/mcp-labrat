import fetchData from '@/utils/fetchData';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  ChatCompletion,
  ChatCompletionMessageParam,
} from 'openai/resources/index';

type RunPromptResponse = {
  answer: string;
  toolCalls: number;
};

const MAX_ROUNDS = 10;

export const runPromptWithMcpServer = async (
  prompt: string,
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

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `
        You are a specialized assistant with access to specific MCP tools.
        The current date and time is ${new Date().toISOString()} (ISO 8601, UTC).

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
                (c): c is { type: 'text'; text: string } => c.type === 'text',
              )
              .map((c) => c.text);

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
