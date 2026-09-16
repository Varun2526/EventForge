import { Router } from 'express';
import { TicketController } from '../controllers/ticketController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireEventRole } from '../middleware/rbacMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createTicketTierSchema, updateTicketTierSchema } from '../validators/ticketValidator.js';

const router = Router();

router.get('/event/:eventId', TicketController.listTicketsByEvent);
router.get('/:id', TicketController.getTicketTier);

router.post(
  '/',
  authenticate,
  requireEventRole('event_organizer'),
  validateRequest({ body: createTicketTierSchema }),
  TicketController.createTicketTier
);

router.put(
  '/:id',
  authenticate,
  requireEventRole('event_organizer'),
  validateRequest({ body: updateTicketTierSchema }),
  TicketController.updateTicketTier
);

router.delete('/:id', authenticate, requireEventRole('event_organizer'), TicketController.deleteTicketTier);

export default router;
