import crypto from 'crypto';
import { env } from '../config/env.js';

export class QRVerificationEngine {
  /**
   * Generates a signed cryptographic badge token for an attendee pass.
   * Format: base64 payload with HMAC-SHA256 signature.
   */
  static signBadgeToken({ passNumber, regNum, eventId, userId, tierId }) {
    const payload = JSON.stringify({
      p: passNumber,
      r: regNum,
      e: eventId.toString(),
      u: userId.toString(),
      t: tierId.toString(),
      iat: Math.floor(Date.now() / 1000)
    });

    const secret = env.JWT_SECRET || 'fallback-secret-key';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const encodedPayload = Buffer.from(payload).toString('base64url');

    return `EFB1.${encodedPayload}.${signature}`;
  }
}
