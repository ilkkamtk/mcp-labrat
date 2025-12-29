import express from 'express';
import { postMcp } from '../controllers/mcpServerController';

const router = express.Router();

router.route('/').post(postMcp);

export default router;
