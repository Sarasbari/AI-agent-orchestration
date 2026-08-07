const { ZodError } = require('zod');

/**
 * Wrap async route handlers to catch errors and forward to error middleware.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Application-level error with HTTP status code.
 */
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Global error handler — consistent { error: { message, code } } shape.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  // Zod validation errors → 400
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  // Known application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  // Duplicate key (PostgreSQL unique constraint violation)
  if (err.code === '23505') {
    return res.status(409).json({
      error: {
        message: 'Resource already exists',
        code: 'DUPLICATE',
      },
    });
  }

  // Unhandled errors — don't leak internals
  const logger = require('../logger');
  logger.error({ err }, 'Unhandled error');

  return res.status(500).json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
};

module.exports = { asyncHandler, AppError, errorHandler };
