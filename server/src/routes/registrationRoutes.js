import { Router } from 'express';
import { RegistrationController } from '../controllers/registrationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireEventRole } from '../middleware/rbacMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { checkoutLimiter } from '../middleware/rateLimiter.js';
import { holdTicketSchema, joinWaitlistSchema } from '../validators/registrationValidator.js';

const router = Router();

router.use(authenticate);

// 1. Checkout & Waitlist Actions
router.post('/hold', checkoutLimiter, validateRequest({ body: holdTicketSchema }), RegistrationController.holdTicket);
router.post('/waitlist', validateRequest({ body: joinWaitlistSchema }), RegistrationController.joinWaitlist);
router.delete('/waitlist/:registrationId', RegistrationController.leaveWaitlist);

// 2. Attendee Ticket Hub
router.get('/my-tickets', RegistrationController.getMyTickets);
router.get('/:id', RegistrationController.getRegistration);

// 3. Organizer Views
router.get('/waitlist/:eventId', requireEventRole('event_organizer'), RegistrationController.getWaitlistByEvent);
router.get('/event/:eventId', requireEventRole('event_organizer'), RegistrationController.getEventRegistrations);

export default router;
