import { NextFunction, Request, Response } from 'express';
import { promises as fs } from 'fs';
import { ErrorResponse } from './types/LocalTypes';
import CustomError from './classes/CustomError';
import fetchData from './utils/fetchData';
import { TranscriptionVerbose } from 'openai/resources/audio/transcriptions';

const openAiApiUrl = process.env.OPENAI_API_URL;
if (!openAiApiUrl) {
  throw new Error('OPENAI_API_URL environment variable is not set');
}

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
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      next();
      return;
    }

    const audioBuffer = await fs.readFile(req.file.path);
    const audioBlob = new Blob([audioBuffer], {
      type: req.file.mimetype ?? 'application/octet-stream',
    });

    const formData = new FormData();
    formData.append('file', audioBlob, req.file.originalname ?? 'audio');
    formData.append('model', 'whisper-1');

    const transcription = await fetchData<TranscriptionVerbose>(
      openAiApiUrl + '/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: formData,
      },
    );

    console.log('transcription', transcription.text);

    req.body.prompt = transcription.text;

    // Best-effort, deterministic cleanup of uploaded file
    try {
      if (filePath) {
        await fs.unlink(filePath);
      }
    } catch (err) {
      console.error('Failed to delete uploaded file:', err);
    }

    next();
  } catch (error) {
    // Attempt cleanup even on error
    try {
      if (filePath) {
        await fs.unlink(filePath);
      }
    } catch (err) {
      console.error('Failed to delete uploaded file:', err);
    }

    next(
      new CustomError(
        (error as Error)?.message ?? 'Audio transcription failed',
        500,
      ),
    );
  }
};

export { notFound, errorHandler, audioTranscriptionMiddleware };
