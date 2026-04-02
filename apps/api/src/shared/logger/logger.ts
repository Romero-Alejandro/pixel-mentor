import pino, { type Logger as PinoLogger } from 'pino';
import { type Config } from '@/shared/config/index.js';

export type LogLevel = pino.Level;

export interface LoggerOptions {
  level?: LogLevel;
  pretty?: boolean;
  name?: string;
}

const DEFAULT_OPTIONS: LoggerOptions = {
  level: 'info',
  pretty: process.env['NODE_ENV'] !== 'production',
  name: 'pixel-mentor',
};

/**
 * Determine if we're in development mode
 */
function isDevelopment(): boolean {
  return process.env['NODE_ENV'] === 'development';
}

/**
 * Get log level from Config or environment variable
 * Config takes precedence over NODE_ENV-based defaults
 */
function getLogLevel(config?: Config): pino.Level {
  // Use LOG_LEVEL from config if available
  const configLevel = config?.LOG_LEVEL;
  if (configLevel && ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(configLevel)) {
    return configLevel as pino.Level;
  }
  // Fall back to environment variable
  const envLevel = process.env.LOG_LEVEL;
  if (envLevel && ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(envLevel)) {
    return envLevel as pino.Level;
  }
  // Default based on environment
  return isDevelopment() ? 'debug' : 'info';
}

/**
 * Redact paths for sensitive data - used in both dev and prod
 */
const redactPaths = [
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'req.headers["x-api-key"]',
  'req.body.password',
  'req.body.token',
  'req.body.confirmPassword',
  '*.password',
  '*.token',
  '*.apiKey',
  '*.secret',
  '*.accessToken',
  '*.refreshToken',
];

/**
 * Extended redaction for production - includes request bodies
 */
const productionRedactPaths = [...redactPaths, 'req.body'];

/**
 * Create pino transport configuration based on environment
 */
function createTransport(pretty: boolean): pino.TransportTargetOptions | undefined {
  if (!pretty) return undefined;

  return {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      levelFirst: true,
    },
  };
}

/**
 * Create file-based transport for production with rotation
 */
function createFileTransport(): pino.TransportTargetOptions {
  return {
    target: 'pino/file',
    options: {
      destination: 1, // stdout
    },
  };
}

export function createLogger(config?: Config, options: LoggerOptions = {}): PinoLogger {
  const isDev = isDevelopment();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const logLevel = opts.level ?? getLogLevel(config);

  // Determine if we should use pretty printing
  // Dev: enabled, Prod: disabled (JSON to stdout)
  const usePretty = isDev && opts.pretty !== false;

  // Build redact config based on environment
  const redactConfig = isDev
    ? { paths: redactPaths, censor: '[REDACTED]' }
    : { paths: productionRedactPaths, censor: '[REDACTED]' };

  // Base pino options
  const pinoOptions: pino.LoggerOptions = {
    level: logLevel,
    name: opts.name,
    redact: redactConfig,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // Add transport based on environment
  if (isDev) {
    // Development: pretty print to console
    pinoOptions.transport = createTransport(usePretty);
  } else {
    // Production: JSON output, no pretty printing
    // File-based rotation can be added later with pino-roll or similar
    pinoOptions.transport = createFileTransport();
  }

  return pino(pinoOptions);
}

export function createChildLogger(
  parent: PinoLogger,
  bindings: Record<string, unknown>,
): PinoLogger {
  return parent.child(bindings);
}

/**
 * PinoLogger class that implements the Logger interface
 * Provides a cleaner API for logging operations
 */
export class PinoLoggerAdapter implements Logger {
  constructor(private readonly logger: PinoLogger) {}

  info(message: string, data?: LogData): void {
    if (data) {
      this.logger.info(data, message);
    } else {
      this.logger.info(message);
    }
  }

  warn(message: string, data?: LogData): void {
    if (data) {
      this.logger.warn(data, message);
    } else {
      this.logger.warn(message);
    }
  }

  error(message: string, error?: Error, data?: LogData): void {
    const logData: LogData = { ...data };
    if (error) {
      logData.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }
    this.logger.error(logData, message);
  }

  debug(message: string, data?: LogData): void {
    if (data) {
      this.logger.debug(data, message);
    } else {
      this.logger.debug(message);
    }
  }

  /**
   * Get the underlying pino logger for advanced operations
   */
  getPinoLogger(): PinoLogger {
    return this.logger;
  }
}

/**
 * Interface for generic logger usage
 */
export interface LogData {
  [key: string]: unknown;
}

export interface Logger {
  info(message: string, data?: LogData): void;
  warn(message: string, data?: LogData): void;
  error(message: string, error?: Error, data?: LogData): void;
  debug(message: string, data?: LogData): void;
}
