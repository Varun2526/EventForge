import { AppError } from '../utils/AppError.js';

/**
 * Higher-order middleware to validate incoming requests against Zod schemas.
 * Validates any combination of `body`, `params`, and `query`.
 *
 * @param {Object} schemas - Map of request parts to Zod schemas
 * @param {import('zod').ZodSchema} [schemas.body] - Schema for req.body
 * @param {import('zod').ZodSchema} [schemas.params] - Schema for req.params
 * @param {import('zod').ZodSchema} [schemas.query] - Schema for req.query
 */
export const validateRequest = (schemas) => {
  return (req, res, next) => {
    const errorDetails = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          errorDetails.push({
            location: 'body',
            field: issue.path.join('.'),
            message: issue.message
          });
        });
      } else {
        req.body = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          errorDetails.push({
            location: 'params',
            field: issue.path.join('.'),
            message: issue.message
          });
        });
      } else {
        req.params = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          errorDetails.push({
            location: 'query',
            field: issue.path.join('.'),
            message: issue.message
          });
        });
      } else {
        req.query = result.data;
      }
    }

    if (errorDetails.length > 0) {
      return next(new AppError('Request validation failed.', 400, 'VALIDATION_ERROR', errorDetails));
    }

    next();
  };
};
