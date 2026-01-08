import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import CustomError from '@/classes/CustomError';
import { runPromptWithMcpServer } from '@/mcp-client';
import { DEFAULT_TIMEZONE, timezoneSchema } from '@/utils/weekday';

const BodySchema = z.object({
  prompt: z.string().min(1),
  // Validate timezone at API boundary - returns 400 for invalid timezones
  timezone: timezoneSchema.default(DEFAULT_TIMEZONE),
});

const postPrompt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = BodySchema.safeParse(req.body);
    if (!parseResult.success) {
      next(new CustomError(parseResult.error.message, 400));
      return;
    }

    const { prompt, timezone } = parseResult.data;
    const result = await runPromptWithMcpServer(prompt, timezone);
    res.json(result);
  } catch (error) {
    next(new CustomError((error as Error).message, 500));
  }
};

export { postPrompt };
