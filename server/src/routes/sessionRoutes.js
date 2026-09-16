import { Router } from 'express';
import { SessionController } from '../controllers/sessionController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireEventRole } from '../middleware/rbacMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createSessionSchema, updateSessionSchema } from '../validators/sessionValidator.js';

const router = Router();

router.get('/event/:eventId', SessionController.listSessionsByEvent);
router.get('/:id', SessionController.getSession);

router.post(
  '/',
  authenticate,
  requireEventRole('event_organizer'),
  validateRequest({ body: createSessionSchema }),
  SessionController.createSession
);

router.put(
  '/:id',
  authenticate,
  validateRequest({ body: updateSessionSchema }),
  SessionController.updateSession
);

router.delete('/:id', authenticate, SessionController.deleteSession);

export default router;
