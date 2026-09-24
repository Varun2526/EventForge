import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

export class StripePaymentProvider {
  static getClient() {
    const key = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new AppError(
        'Stripe secret key is not configured in server environment. Set STRIPE_SECRET_KEY in .env.',
        503,
        'STRIPE_CONFIG_MISSING'
      );
    }
    return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
  }

  static getWebhookSecret() {
    return env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  /**
   * Creates a real Stripe PaymentIntent.
   */
  static async createPaymentIntent({ amount, currency = 'usd', metadata = {} }) {
    const stripe = this.getClient();
    const amountInCents = Math.max(50, Math.round(amount * 100)); // Stripe minimum 50 cents

    try {
      const intent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        metadata: {
          ...metadata,
          platform: 'EventForge'
        },
        automatic_payment_methods: {
          enabled: true
        }
      });

      return {
        id: intent.id,
        clientSecret: intent.client_secret,
        amount,
        currency,
        status: intent.status,
        provider: 'stripe'
      };
    } catch (err) {
      throw new AppError(`Stripe payment intent creation failed: ${err.message}`, 502, 'PAYMENT_GATEWAY_ERROR');
    }
  }

  /**
   * Cryptographically verifies Stripe webhook signature header (stripe-signature).
   */
  static verifyWebhookSignature({ rawBody, signature, secret }) {
    if (!signature) {
      throw new AppError('Missing Stripe webhook signature header.', 400, 'PAYMENT_SIGNATURE_MISSING');
    }

    const secretToUse = secret || this.getWebhookSecret();
    if (!secretToUse) {
      throw new AppError('Stripe webhook secret is not configured.', 503, 'STRIPE_WEBHOOK_SECRET_MISSING');
    }

    const stripe = this.getClient();
    try {
      stripe.webhooks.constructEvent(rawBody, signature, secretToUse);
      return true;
    } catch (err) {
      throw new AppError(`Stripe webhook signature verification failed: ${err.message}`, 400, 'PAYMENT_SIGNATURE_INVALID');
    }
  }

  /**
   * Normalizes Stripe webhook event payload into standard EventForge shape.
   */
  static parseWebhookEvent(eventPayload) {
    let event = eventPayload;
    if (typeof event === 'string') {
      try {
        event = JSON.parse(eventPayload);
      } catch {
        throw new AppError('Malformed Stripe webhook JSON payload.', 400, 'INVALID_PAYMENT_PAYLOAD');
      }
    }

    const eventId = event?.id;
    const eventType = event?.type;
    const object = event?.data?.object;

    if (!eventId || !eventType || !object) {
      throw new AppError('Invalid Stripe webhook event structure.', 400, 'INVALID_PAYMENT_PAYLOAD');
    }

    return {
      eventId,
      eventType,
      registrationId: object.metadata?.registrationId || null,
      paymentIntentId: object.id,
      amount: object.amount ? object.amount / 100 : 0,
      currency: object.currency,
      status: object.status,
      rawEvent: event
    };
  }

  /**
   * Retrieves live status from Stripe for client confirmation.
   */
  static async getPaymentStatus(paymentIntentId) {
    const stripe = this.getClient();
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return {
        id: intent.id,
        status: intent.status,
        amount: intent.amount / 100,
        currency: intent.currency,
        metadata: intent.metadata
      };
    } catch (err) {
      throw new AppError(`Failed to retrieve Stripe payment status: ${err.message}`, 502, 'PAYMENT_GATEWAY_ERROR');
    }
  }
}
