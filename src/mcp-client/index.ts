import fetchData from '@/utils/fetchData';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  ChatCompletion,
  ChatCompletionMessageParam,
} from 'openai/resources/index';

// Määritellään yksinkertainen tyyppi MCP-sisällölle
type McpContent = { type: 'text'; text: string } | { type: string };

type RunPromptResponse = {
  answer: string;
  toolCalls: number;
  messages: ChatCompletionMessageParam[];
};

export const runPromptWithMcpServer = async (
  prompt: string,
): Promise<RunPromptResponse> => {
  const transport = new StreamableHTTPClientTransport(
    new URL(process.env.MCP_SERVER_URL!),
  );
  const mcpClient = new Client(
    { name: 'mcp-client', version: '1.0.0' },
    { capabilities: {} },
  );
  await mcpClient.connect(transport);

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: 'You are a helpful assistant with tool access.',
    },
    { role: 'user', content: prompt },
  ];

  try {
    const { tools } = await mcpClient.listTools();
    const openaiTools = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema ?? { type: 'object', properties: {} },
      },
    }));

    let toolCallsCount = 0;

    for (let i = 0; i < 10; i++) {
      const completion = await fetchData<ChatCompletion>(
        `${process.env.OPENAI_API_URL}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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

      await Promise.all(
        message.tool_calls.map(async (call) => {
          if (call.type !== 'function') return;

          const result = await mcpClient.callTool({
            name: call.function.name,
            arguments: JSON.parse(call.function.arguments),
          });

          const textContent = (result.content as McpContent[])
            .filter(
              (c): c is { type: 'text'; text: string } => c.type === 'text',
            )
            .map((c) => c.text)
            .join('\n');

          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: textContent || JSON.stringify(result),
          });
        }),
      );
    }

    // TÄMÄ PUUTTUI: Heitä virhe jos 10 kierrosta ylittyy
    throw new Error('Maximum tool call rounds reached');
  } finally {
    // Varmistetaan aina yhteyden sulkeminen
    await transport.close();
  }
};
