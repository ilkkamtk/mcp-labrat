import express from 'express';
import { postPrompt } from '../controllers/mcpClientController';
import multer from 'multer';
import { audioTranscriptionMiddleware } from '@/middlewares';
import CustomError from '@/classes/CustomError';

const DEFAULT_MAX_AUDIO_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MiB
const maxAudioUploadBytes = (() => {
  const raw = process.env.MAX_AUDIO_UPLOAD_BYTES;
  if (!raw) return DEFAULT_MAX_AUDIO_UPLOAD_BYTES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_AUDIO_UPLOAD_BYTES;
})();

export const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: maxAudioUploadBytes },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('audio/')) {
      cb(null, true);
      return;
    }

    cb(
      new CustomError(
        'Only audio uploads are allowed (mimetype must start with "audio/").',
        400,
      ),
    );
  },
});

const router = express.Router();

router
  .route('/')
  .post(upload.single('audio'), audioTranscriptionMiddleware, postPrompt);

export default router;
