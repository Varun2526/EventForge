import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Generate a signed JWT token containing minimal user identity claims.
 * @param {Object} payload
 * @param {string} payload.id - User MongoDB ID
 * @param {string} payload.globalRole - User global platform role ('platform_admin' | 'user')
 * @param {string} payload.email - User email address
 * @param {string} [expiresIn] - Optional custom expiration duration
 * @returns {string} Signed JWT
 */
export const signToken = (payload, expiresIn = env.JWT_EXPIRES_IN) => {
  return jwt.sign(
    {
      id: payload.id,
      globalRole: payload.globalRole,
      email: payload.email
    },
    env.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Verify and decode an incoming JWT token.
 * @param {string} token - Raw JWT string
 * @returns {Object} Decoded payload claims
 * @throws {JsonWebTokenError | TokenExpiredError}
 */
export const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};
