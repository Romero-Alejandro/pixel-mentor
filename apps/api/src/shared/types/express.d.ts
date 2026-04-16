import type { Request, Response, NextFunction } from 'express';
import type pino from 'pino';

// Extend Express Request type for app-specific properties
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

export type AppRequestHandler = (
  req: AppRequest,
  res: Response,
  next?: NextFunction,
) => Promise<void> | void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyHandler = (...args: any[]) => any;

// Workaround for Express 5 router handler types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteHandler = (req: AppRequest, res: Response, next: NextFunction) => any;
