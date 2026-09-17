import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireEventRole } from '../middleware/rbacMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { eventIdParamSchema } from '../validators/analyticsValidator.js';

const router = Router();

router.get(
  '/:eventId/summary',
  authenticate,
  requireEventRole('event_organizer', 'event_staff'),
  validateRequest({ params: eventIdParamSchema }),
  AnalyticsController.getSummary
);

router.get(
  '/:eventId/heatmaps',
  authenticate,
  requireEventRole('event_organizer', 'event_staff'),
  validateRequest({ params: eventIdParamSchema }),
  AnalyticsController.getHeatmaps
);

router.get(
  '/:eventId/sponsors',
  authenticate,
  requireEventRole('event_organizer', 'event_staff'),
  validateRequest({ params: eventIdParamSchema }),
  AnalyticsController.getSponsors
);

router.get(
  '/:eventId/feedback',
  authenticate,
  requireEventRole('event_organizer', 'event_staff'),
  validateRequest({ params: eventIdParamSchema }),
  AnalyticsController.getFeedback
);

export default router;
