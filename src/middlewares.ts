import { NextFunction, Request, Response } from 'express';
import { promises as fs } from 'fs';
import { ErrorResponse } from './types/LocalTypes';
import CustomError from './classes/CustomError';
import fetchData from './utils/fetchData';
import { TranscriptionVerbose } from 'openai/resources/audio/transcriptions';

const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new CustomError(`🔍 - Not Found - ${req.originalUrl}`, 404);
  next(error);
};

const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response<ErrorResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) => {
  // console.log(err);
  const statusCode = err.status && err.status >= 400 ? err.status : 500;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
  });
};

/**
 * Middleware to receive audio and transcribe it using OpenAI's Whisper API.
 */
const audioTranscriptionMiddleware = async (
  req: Request<object, object, { prompt?: string }> & {
    file?: Express.Multer.File;
  },
  _res: Response,
  next: NextFunction,
) => {
  const file = req.file;
  if (!file) {
    next();
    return;
  }

  const filePath = file.path;
  const cleanup = async () => {
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.error('Failed to delete uploaded file:', err);
    }
  };

  try {
    const openAiApiUrl = process.env.OPENAI_API_URL;
    if (!openAiApiUrl) {
      throw new CustomError(
        'Audio transcription service is not configured on the server',
        500,
      );
    }

    const audioBuffer = await fs.readFile(filePath);
    const audioBlob = new Blob([audioBuffer], {
      type: file.mimetype ?? 'application/octet-stream',
    });

    const formData = new FormData();
    formData.append('file', audioBlob, file.originalname ?? 'audio');
    formData.append('model', 'whisper-1');

    const transcription = await fetchData<TranscriptionVerbose>(
      openAiApiUrl + '/v1/audio/transcriptions',
      {
        method: 'POST',
        body: formData,
      },
    );

    req.body.prompt = transcription.text;

    if (process.env.DEBUG_TRANSCRIPTION === 'true') {
      console.debug('transcription received', {
        length: transcription.text?.length ?? 0,
      });
    }

    next();
  } catch (error) {
    if (error instanceof CustomError) {
      next(error);
    } else {
      next(
        new CustomError(
          (error as Error)?.message ?? 'Audio transcription failed',
          500,
        ),
      );
    }
  } finally {
    // Best-effort, deterministic cleanup of uploaded file
    await cleanup();
  }
};

export { notFound, errorHandler, audioTranscriptionMiddleware };
