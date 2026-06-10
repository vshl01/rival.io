/**
 * Operational error with an HTTP status and a stable machine-readable code.
 * Anything thrown that is *not* an AppError is treated as an unexpected 500.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found') {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(message = 'Resource already exists') {
    return new AppError(409, 'CONFLICT', message);
  }
  static payloadTooLarge(message = 'Payload too large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', message);
  }
  static tooManyRequests(message = 'Too many requests') {
    return new AppError(429, 'TOO_MANY_REQUESTS', message);
  }
}
