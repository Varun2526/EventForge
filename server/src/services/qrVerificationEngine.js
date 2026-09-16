import crypto from 'crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export class QRVerificationEngine {
  static getBadgeSecret() {
    return env.BADGE_JWT_SECRET || env.JWT_SECRET || 'eventforge_badge_hmac_secret_key_32bytes_min!';
  }

  /**
   * Generates a signed cryptographic badge token for an attendee pass.
   * Format: EFB1.<base64url_payload>.<hex_signature>
   * Alg: HMAC-SHA256
   */
  static signBadgeToken({ passNumber, regNum, eventId, userId, tierId, expiresInSeconds = 30 * 86400, secret }) {
    const payload = JSON.stringify({
      p: passNumber,
      r: regNum,
      e: eventId.toString(),
      u: userId.toString(),
      t: tierId.toString(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds
    });

    const secretToUse = secret || this.getBadgeSecret();
    const signature = crypto.createHmac('sha256', secretToUse).update(payload).digest('hex');
    const encodedPayload = Buffer.from(payload).toString('base64url');

    return `EFB1.${encodedPayload}.${signature}`;
  }

  /**
   * Cryptographically verifies a badge token and returns trusted claims.
   * Does NO           T perform database mutations.
   */
  static verifyBadgeToken(token, secret) {
    if (!token || typeof token !== 'string') {
      throw new AppError('Badge token must be a non-empty string.', 400, 'INVALID_BADGE');
    }

    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'EFB1') {
      throw new AppError('Malformed badge token format or unsupported version prefix.', 400, 'INVALID_BADGE');
    }

    const [, encodedPayload, signature] = parts;
    let payloadJsonStr;
    try {
      payloadJsonStr = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    } catch {
      throw new AppError('Malformed base64url payload in badge token.', 400, 'INVALID_BADGE');
    }

    // Verify HMAC-SHA256 signature
    const secretToUse = secret || this.getBadgeSecret();
    const expectedSignature = crypto.createHmac('sha256', secretToUse).update(payloadJsonStr).digest('hex');

    if (signature !== expectedSignature) {
      throw new AppError('Badge cryptographic signature verification failed.', 400, 'BADGE_INVALID_SIGNATURE');
    }

    // Parse JSON payload
    let payload;
    try {
      payload = JSON.parse(payloadJsonStr);
    } catch {
      throw new AppError('Invalid JSON structure in badge payload.', 400, 'INVALID_BADGE');
    }

    // Validate required claims
    if (!payload.p || !payload.r || !payload.e || !payload.u || !payload.t) {
      throw new AppError('Badge token is missing required identity claims.', 400, 'INVALID_BADGE');
    }

    // Validate expiration
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      throw new AppError('Badge token has expired.', 400, 'BADGE_EXPIRED');
    }

    return {
      passNumber: payload.p,
      registrationNumber: payload.r,
      eventId: payload.e,
      userId: payload.u,
      ticketTierId: payload.t,
      issuedAt: new Date(payload.iat * 1000),
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null
    };
  }
}
