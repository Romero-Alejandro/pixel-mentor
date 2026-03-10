import 'express-serve-static-core';
import pino from 'pino';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    logger?: pino.Logger;
    startTime?: number;
  }
}
