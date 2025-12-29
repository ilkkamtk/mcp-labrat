import express from 'express';
import { postMcp } from '../controllers/mcpController';

const router = express.Router();

router.route('/').post(postMcp);

export default router;
