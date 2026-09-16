import { Router } from 'express';
import { CheckInController } from '../controllers/checkInController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { gateCheckInSchema, sessionCheckInSchema } from '../validators/checkInValidator.js';

const router = Router();

// All check-in endpoints require authentication
router.use(authenticate);

// Main event gate scanner
router.post('/event', validateRequest({ body: gateCheckInSchema }), CheckInController.checkInEventGate);

// Session door scanner
router.post('/session', validateRequest({ body: sessionCheckInSchema }), CheckInController.checkInSessionDoor);

export default router;
