import { PaymentService } from '../services/paymentService.js';
import { AppError } from '../utils/AppError.js';

export class PaymentController {
  static async createPaymentIntent(req, res, next) {
    try {
      const result = await PaymentService.createPaymentIntent({
        registrationId: req.body.registrationId,
        user: req.user
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async handleWebhook(req, res, next) {
    try {
      const provider = req.headers['x-payment-provider'] || 'mock';
      const signature =
        req.headers['stripe-signature'] ||
        req.headers['x-mock-signature'] ||
        req.headers['x-signature'] ||
        req.headers['signature'];

      if (!signature) {
        throw new AppError('Missing webhook signature header.', 400, 'PAYMENT_SIGNATURE_INVALID');
      }

      // If req.rawBody is not populated, fallback to stringifying JSON body
      const rawBody = req.rawBody || JSON.stringify(req.body);

      const result = await PaymentService.handleWebhookEvent({
        provider,
        rawBody,
        signature
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async verifyPayment(req, res, next) {
    try {
      const confirmedRegistration = await PaymentService.verifyClientPayment({
        registrationId: req.body.registrationId,
        paymentIntentId: req.body.paymentIntentId,
        user: req.user
      });

      res.status(200).json({
        success: true,
        data: { registration: confirmedRegistration }
      });
    } catch (err) {
      next(err);
    }
  }
}
