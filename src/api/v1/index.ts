import express, { Request, Response } from 'express';

import mcpServerRouter from './routes/mcpServerRouter';
import mcpClientRouter from './routes/mcpClientRouter';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'media api v1',
  });
});

router.use('/mcp', mcpServerRouter);
router.use('/client/', mcpClientRouter);

export default router;
