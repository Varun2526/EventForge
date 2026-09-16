import { MockPaymentProvider } from './mockPaymentProvider.js';

export class PaymentProvider {
  static getProvider(providerName = process.env.PAYMENT_PROVIDER || 'mock') {
    switch (providerName) {
      case 'mock':
      default:
        return MockPaymentProvider;
    }
  }

  static async createPaymentIntent(params) {
    return this.getProvider().createPaymentIntent(params);
  }

  static verifyWebhookSignature(params) {
    return this.getProvider().verifyWebhookSignature(params);
  }

  static parseWebhookEvent(params) {
    return this.getProvider().parseWebhookEvent(params);
  }

  static async getPaymentStatus(paymentIntentId) {
    return this.getProvider().getPaymentStatus(paymentIntentId);
  }
}
