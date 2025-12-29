import express from 'express';
import { postPrompt } from '../controllers/mcpClientController';

const router = express.Router();

router.route('/').post(postPrompt);

export default router;
