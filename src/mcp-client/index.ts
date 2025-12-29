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
  messages: ChatCompletionMessageParam[];
};

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
      content: `You are a helpful assistant with tool access. 
      Current time is ${new Date().toISOString()}. 
      Always look at the tool outputs carefully before answering.`,
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
        parameters: tool.inputSchema ?? { type: 'object', properties: {} },
      },
    }));

    let toolCallsCount = 0;

    for (let i = 0; i < 10; i++) {
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
          }),
        },
      );

      const message = completion.choices[0]?.message;
      if (!message) throw new Error('No message returned from OpenAI');

      // Varmistetaan että viesti on oikeassa muodossa historialistassa
      messages.push({
        role: message.role,
        content: message.content || '',
        tool_calls: message.tool_calls,
      });

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return {
          answer: message.content || '',
          toolCalls: toolCallsCount,
          messages: messages,
        };
      }

      toolCallsCount += message.tool_calls.length;

      const toolResults = await Promise.all(
        message.tool_calls.map(async (call) => {
          if (call.type !== 'function') return null;

          try {
            const result = await mcpClient.callTool({
              name: call.function.name,
              arguments: JSON.parse(call.function.arguments),
            });

            // YHDISTETTY LUKU: Teksti + jäsennelty sisältö
            const textParts = (
              result.content as { type: string; text: string }[]
            )
              .filter((content) => content.type === 'text')
              .map((content) => content.text);

            // Jos työkalu palautti structuredContent (kuten listEvents), lisätään se mukaan
            if (result.structuredContent) {
              textParts.push(JSON.stringify(result.structuredContent));
            }

            // Jos kumpaakaan ei löytynyt, varmuuskopio koko resultista
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
              content: `Error in ${call.function.name}: ${error instanceof Error ? error.message : String(error)}`,
            } as ChatCompletionMessageParam;
          }
        }),
      );

      messages.push(...toolResults.filter((result) => result !== null));
    }
    throw new Error('Max rounds reached');
  } finally {
    await transport.close();
  }
};
