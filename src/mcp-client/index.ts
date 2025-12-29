import fetchData from '@/utils/fetchData';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ChatCompletion } from 'openai/resources/index';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

type OpenAiFunctionTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

type McpToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

type ToolTraceEntry = {
  tool_call_id: string;
  name: string;
  arguments: unknown;
  output: string;
  error?: string;
};

const openAIbaseUrl = process.env.OPENAI_API_URL;
if (!openAIbaseUrl) {
  throw new Error('OPENAI_API_URL is not defined');
}

const mcpServerUrl = process.env.MCP_SERVER_URL;
if (!mcpServerUrl) {
  throw new Error('MCP_SERVER_URL is not defined');
}

const getToolText = (result: unknown) => {
  const maybeResult = result as {
    content?: Array<{ type?: unknown; text?: unknown }>;
    structuredContent?: unknown;
    isError?: boolean;
  };

  const textParts = (maybeResult.content ?? [])
    .filter((c) => c?.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string);

  const text = textParts.join('\n').trim();
  if (text) return text;
  if (maybeResult.structuredContent !== undefined) {
    return JSON.stringify(maybeResult.structuredContent, null, 2);
  }
  return '(no tool output)';
};

const mcpToolsToOpenAiTools = (
  tools: McpToolDefinition[],
): OpenAiFunctionTool[] => {
  return tools.map((tool) => {
    const parameters =
      tool.inputSchema && typeof tool.inputSchema === 'object'
        ? tool.inputSchema
        : { type: 'object', properties: {} };

    return {
      type: 'function',
      function: {
        name: String(tool.name),
        description: tool.description ? String(tool.description) : undefined,
        parameters,
      },
    };
  });
};

const parseToolArguments = (raw: unknown): unknown => {
  if (raw === undefined || raw === null || raw === '') return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

/**
 * Runs a user prompt through OpenAI, allowing the model to call MCP tools exposed by the local MCP server.
 */
const runPromptWithMcpServer = async (prompt: string) => {
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const maxToolRounds = 8;

  const mcpClient = new Client({ name: 'mcp-labrat-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl));
  await mcpClient.connect(transport);

  try {
    const toolsResult = await mcpClient.listTools();
    const tools = toolsResult.tools as unknown as McpToolDefinition[];
    const openaiTools = mcpToolsToOpenAiTools(tools);

    const toolTrace: ToolTraceEntry[] = [];
    let toolCallsTotal = 0;

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are a helpful assistant. Use the provided tools when needed. When calling a tool, strictly follow its JSON schema for arguments.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    for (let round = 0; round < maxToolRounds; round++) {
      const options: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // IMPORTANT: messages are mutated each round; rebuild body each request.
        body: JSON.stringify({
          model,
          messages,
          tools: openaiTools,
          tool_choice: 'auto',
        }),
      };

      const completion = await fetchData<ChatCompletion>(
        openAIbaseUrl + '/v1/chat/completions',
        options,
      );

      const message = completion.choices[0]?.message;
      if (!message) {
        throw new Error('OpenAI returned no message');
      }

      // Convert response message -> request message param shape
      messages.push({
        role: message.role,
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });

      if (process.env.DEBUG_MCP_CLIENT === '1') {
        console.log('openai.message', message);
      }

      const toolCalls = message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return {
          answer: message.content ?? '',
          model,
          mcpServerUrl,
          toolCalls: toolCallsTotal,
          toolTrace,
        };
      }

      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue;

        toolCallsTotal++;

        const toolName = toolCall.function.name;
        const args = parseToolArguments(toolCall.function.arguments);

        let toolOutputText = '';
        let toolError: string | undefined;
        try {
          const result = await mcpClient.callTool({
            name: toolName,
            arguments: args as Record<string, unknown>,
          });
          toolOutputText = getToolText(result);
        } catch (error) {
          toolError = (error as Error).message;
          toolOutputText = `Error calling tool "${toolName}": ${toolError}`;
        }

        toolTrace.push({
          tool_call_id: toolCall.id,
          name: toolName,
          arguments: args,
          output: toolOutputText,
          error: toolError,
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolOutputText,
        });
      }
    }

    throw new Error(
      `Max tool rounds reached (${maxToolRounds}). The model kept requesting tools.`,
    );
  } finally {
    await transport.close();
  }
};

export { runPromptWithMcpServer };
