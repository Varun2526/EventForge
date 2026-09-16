import { Router } from 'express';
import { SpeakerController } from '../controllers/speakerController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireEventRole } from '../middleware/rbacMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createSpeakerSchema, updateSpeakerSchema } from '../validators/speakerValidator.js';

const router = Router();

router.get('/event/:eventId', SpeakerController.listSpeakersByEvent);
router.get('/:id', SpeakerController.getSpeaker);

router.post(
  '/',
  authenticate,
  requireEventRole('event_organizer'),
  validateRequest({ body: createSpeakerSchema }),
  SpeakerController.createSpeaker
);

router.put(
  '/:id',
  authenticate,
  validateRequest({ body: updateSpeakerSchema }),
  SpeakerController.updateSpeaker
);

router.delete('/:id', authenticate, SpeakerController.deleteSpeaker);

export default router;
