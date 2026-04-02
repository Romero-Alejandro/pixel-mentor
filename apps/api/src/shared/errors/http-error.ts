import { AppError } from './app-error.js';

export class HttpError extends AppError {
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(code ?? `HTTP_${status}`, status, message, details);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, message, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized'): HttpError {
    return new HttpError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden'): HttpError {
    return new HttpError(403, message, 'FORBIDDEN');
  }

  static notFound(resource: string, id?: string): HttpError {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    return new HttpError(404, message, 'NOT_FOUND');
  }

  static conflict(message: string, details?: unknown): HttpError {
    return new HttpError(409, message, 'CONFLICT', details);
  }

  static unprocessable(message: string, details?: unknown): HttpError {
    return new HttpError(422, message, 'UNPROCESSABLE', details);
  }

  static internal(message = 'Internal server error'): HttpError {
    return new HttpError(500, message, 'INTERNAL_ERROR');
  }
}
