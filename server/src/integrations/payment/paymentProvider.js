import { StripePaymentProvider } from './stripePaymentProvider.js';
import { MockPaymentProvider } from './mockPaymentProvider.js';

export class PaymentProvider {
  static getProvider(providerName) {
    const chosen = providerName || process.env.PAYMENT_PROVIDER;

    if (chosen === 'stripe') {
      return StripePaymentProvider;
    }
    if (chosen === 'mock') {
      return MockPaymentProvider;
    }

    // Default to Stripe if API key is present
    if (process.env.STRIPE_SECRET_KEY) {
      return StripePaymentProvider;
    }

    return MockPaymentProvider;
  }

  static async createPaymentIntent(params) {
    return this.getProvider(params?.provider).createPaymentIntent(params);
  }

  static verifyWebhookSignature(params) {
    return this.getProvider(params?.provider).verifyWebhookSignature(params);
  }

  static parseWebhookEvent(params) {
    return this.getProvider(params?.provider).parseWebhookEvent(params);
  }

  static async getPaymentStatus(paymentIntentId, provider) {
    return this.getProvider(provider).getPaymentStatus(paymentIntentId);
  }
}
