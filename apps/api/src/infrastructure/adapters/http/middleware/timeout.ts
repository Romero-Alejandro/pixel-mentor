import type { Request, Response, NextFunction } from 'express';

export function timeoutMiddleware(timeoutMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void req;
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(504).json({ error: 'Request timeout' });
      } else {
        res.destroy();
      }
    });
    next();
  };
}
