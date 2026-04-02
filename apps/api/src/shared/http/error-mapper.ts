// Re-export error handling from shared/http
export {
  errorHandler,
  sendErrorResponse,
  mapErrorToResponse,
  getHttpStatus,
  type ErrorResponse,
  type ValidationErrorResponse,
} from '@/shared/http/error-handler.middleware.js';
