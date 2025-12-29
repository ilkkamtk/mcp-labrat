import express, { Request, Response } from 'express';

import mcpRouter from './routes/mcpRouter';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'media api v1',
  });
});

router.use('/mcp', mcpRouter);

export default router;
