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
  /** LLM governance context attached by llmGovernanceMiddleware */
  llmGovernance?: {
    userId: string | null;
    startTime: number;
    provider: string;
    postCallRecord: (
      userId: string | null,
      provider: string,
      model: string,
      path: string,
      prompt: string,
      response: string,
      success: boolean,
      error?: string,
    ) => unknown;
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
