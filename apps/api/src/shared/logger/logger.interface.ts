/**
 * Logger Interface
 *
 * Defines the contract for logging operations across the application.
 * This interface provides a level-based logging abstraction that can be
 * implemented by any logger (pino, winston, etc.).
 */

export interface LogData {
  [key: string]: unknown;
}

export interface Logger {
  /**
   * Log an info message
   */
  info(message: string, data?: LogData): void;

  /**
   * Log a warning message
   */
  warn(message: string, data?: LogData): void;

  /**
   * Log an error message
   */
  error(message: string, error?: Error, data?: LogData): void;

  /**
   * Log a debug message
   */
  debug(message: string, data?: LogData): void;
}