import { Router } from 'express';
import { CouponController } from '../controllers/couponController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireEventRole } from '../middleware/rbacMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createCouponSchema, validateCouponSchema } from '../validators/ticketValidator.js';

const router = Router();

// Public / Attendee checkout coupon validation
router.post('/validate', validateRequest({ body: validateCouponSchema }), CouponController.validateCoupon);

// Organizer coupon management
router.post(
  '/',
  authenticate,
  requireEventRole('event_organizer'),
  validateRequest({ body: createCouponSchema }),
  CouponController.createCoupon
);

router.get(
  '/event/:eventId',
  authenticate,
  requireEventRole('event_organizer'),
  CouponController.listCouponsByEvent
);

export default router;
