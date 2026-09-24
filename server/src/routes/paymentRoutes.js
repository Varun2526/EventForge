import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { checkoutLimiter } from '../middleware/rateLimiter.js';
import { createPaymentIntentSchema, verifyPaymentSchema } from '../validators/paymentValidator.js';

const router = Router();

// Webhook endpoint (Signature verified, NO Bearer JWT required)
router.post('/webhook', PaymentController.handleWebhook);

// Authenticated Client Endpoints
router.post(
  '/create-intent',
  authenticate,
  checkoutLimiter,
  validateRequest({ body: createPaymentIntentSchema }),
  PaymentController.createPaymentIntent
);

router.post(
  '/verify',
  authenticate,
  validateRequest({ body: verifyPaymentSchema }),
  PaymentController.verifyPayment
);

export default router;
