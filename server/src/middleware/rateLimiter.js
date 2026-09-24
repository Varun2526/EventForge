import rateLimit from 'express-rate-limit';

/**
 * Standard factory for rate-limiting middleware that automatically bypasses in test environment.
 */
const createLimiter = (options) => {
  return rateLimit({
    standardHeaders: true, // Return standard RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    skip: () => process.env.NODE_ENV === 'test',
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        code: 'TOO_MANY_REQUESTS',
        message: options.message || 'Too many requests from this IP. Please try again shortly.'
      });
    },
    ...options
  });
};

/**
 * Global API rate limiter: 500 requests per 15 minutes.
 */
export const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'API rate limit exceeded. Please try again in a few minutes.'
});

/**
 * Strict authentication limiter: 25 attempts per 15 minutes to defend against brute force.
 */
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
});

/**
 * Checkout & Hold transaction limiter: 60 requests per 15 minutes.
 */
export const checkoutLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many ticket hold or payment requests. Please try again shortly.'
});
