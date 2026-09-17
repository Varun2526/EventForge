import { Router } from 'express';
import { AIController } from '../controllers/aiController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import {
  generateEventCopySchema,
  generateSpeakerBioSchema,
  generateAnnouncementSchema,
  getRecommendationsParamsSchema
} from '../validators/aiValidator.js';

const router = Router();

router.post(
  '/generate-event-copy',
  authenticate,
  validateRequest({ body: generateEventCopySchema }),
  AIController.generateEventCopy
);

router.post(
  '/generate-speaker-bio',
  authenticate,
  validateRequest({ body: generateSpeakerBioSchema }),
  AIController.generateSpeakerBio
);

router.post(
  '/generate-announcement',
  authenticate,
  validateRequest({ body: generateAnnouncementSchema }),
  AIController.generateAnnouncement
);

router.get(
  '/recommendations/:eventId',
  authenticate,
  validateRequest({ params: getRecommendationsParamsSchema }),
  AIController.getRecommendations
);

export default router;
