import { Router } from 'express';
import { EventController } from '../controllers/eventController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireEventRole } from '../middleware/rbacMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createEventSchema, updateEventSchema } from '../validators/eventValidator.js';

const router = Router();

// Optional user context extractor for public / private event listing
const optionalAuthenticate = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }
  next();
};

router.get('/', optionalAuthenticate, EventController.listEvents);
router.post('/', authenticate, validateRequest({ body: createEventSchema }), EventController.createEvent);

router.get('/:id', optionalAuthenticate, EventController.getEvent);
router.put(
  '/:id',
  authenticate,
  requireEventRole('event_organizer'),
  validateRequest({ body: updateEventSchema }),
  EventController.updateEvent
);
router.patch('/:id/publish', authenticate, requireEventRole('event_organizer'), EventController.publishEvent);
router.delete('/:id', authenticate, requireEventRole('event_organizer'), EventController.deleteEvent);

export default router;
