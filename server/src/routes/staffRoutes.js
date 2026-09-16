import { Router } from 'express';
import { StaffController } from '../controllers/staffController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { assignStaffSchema } from '../validators/checkInValidator.js';

const router = Router();

router.use(authenticate);

// Assign staff member
router.post('/assign', validateRequest({ body: assignStaffSchema }), StaffController.assignStaff);

// List staff members for an event
router.get('/event/:eventId', StaffController.listStaffByEvent);

export default router;
