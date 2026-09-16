import crypto from 'crypto';
import { AppError } from '../../utils/AppError.js';

export class MockPaymentProvider {
  static getWebhookSecret() {
    return process.env.PAYMENT_WEBHOOK_SECRET || 'mock_whsec_test_secret_12345';
  }

  static async createPaymentIntent({ amount, currency = 'USD', metadata = {} }) {
    const id = `pi_mock_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      id,
      clientSecret: `${id}_secret_${Math.random().toString(36).substring(2, 10)}`,
      amount,
      currency: currency.toUpperCase(),
      status: 'requires_payment_method',
      metadata
    };
  }
  
    // Generates signature for testing webhook delivery.
  static generateSignature(rawBody, secret = this.getWebhookSecret()) {
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const hmac = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
    return `t=${Date.now()},v1=${hmac}`;
  }

  //Verifies mock webhook signature header.
  static verifyWebhookSignature({ rawBody, signature, secret = this.getWebhookSecret() }) {
    if (!signature) {
      throw new AppError('Missing webhook signature header.', 400, 'PAYMENT_SIGNATURE_INVALID');
    }

    const parts = signature.split(',');
    let hash = null;
    for (const part of parts) {
      const [k, v] = part.split('=');
      if (k === 'v1') hash = v;
    }

    if (!hash) {
      throw new AppError('Malformed webhook signature header.', 400, 'PAYMENT_SIGNATURE_INVALID');
    }

    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expectedHash = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

    if (hash !== expectedHash) {
      throw new AppError('Webhook signature verification failed.', 400, 'PAYMENT_SIGNATURE_INVALID');
    }

    return true;
  }

  // Parses webhook event payload after signature verification.
  static parseWebhookEvent({ rawBody, signature, secret = this.getWebhookSecret() }) {
    this.verifyWebhookSignature({ rawBody, signature, secret });
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    try {
      const parsed = JSON.parse(bodyStr);
      return parsed;
    } catch {
      throw new AppError('Invalid JSON payload in webhook body.', 400, 'INVALID_PAYLOAD');
    }
  }

  // Checks current status of a payment intent.
  static async getPaymentStatus(paymentIntentId) {
    return {
      id: paymentIntentId,
      status: 'succeeded'
    };
  }
}
