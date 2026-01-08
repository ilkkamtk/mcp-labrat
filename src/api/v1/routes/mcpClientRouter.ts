import express from 'express';
import { postPrompt } from '../controllers/mcpClientController';
import multer from 'multer';
import { audioTranscriptionMiddleware } from '@/middlewares';
export const upload = multer({ dest: 'uploads/' });

const router = express.Router();

router
  .route('/')
  .post(upload.single('audio'), audioTranscriptionMiddleware, postPrompt);

export default router;
