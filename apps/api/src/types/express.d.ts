import type { Request } from 'express';
import type pino from 'pino';

export interface AppRequest extends Request {
  requestId: string;
  startTime: number;
  logger: pino.Logger;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}
