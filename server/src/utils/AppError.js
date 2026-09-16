/**
 * Operational error class for predictable, categorized application exceptions.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} statusCode - HTTP status code (e.g. 400, 401, 403, 404, 409, 500)
   * @param {string} [code] - Machine-readable stable error code (e.g. 'VALIDATION_ERROR', 'UNAUTHORIZED')
   * @param {any} [details] - Optional granular details (e.g. field-level validation errors)
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
