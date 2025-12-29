import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { NextFunction, Request, Response } from 'express';
import CustomError from '@/classes/CustomError';
import { mcpServer } from '@/mcp-server';

const postMcp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => transport.close());

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    next(new CustomError((error as Error).message, 500));
  }
};

export { postMcp };
