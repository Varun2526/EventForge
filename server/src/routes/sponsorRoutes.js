import { Router } from 'express';
import { SponsorController } from '../controllers/sponsorController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireEventRole } from '../middleware/rbacMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import {
  createSponsorProfileSchema,
  createSponsorPackageSchema,
  allocateSponsorshipSchema,
  updateDeliverableStatusSchema,
  eventIdParamSchema
} from '../validators/sponsorValidator.js';

const router = Router();

// Public / Attendee listing of event sponsors by tier
router.get(
  '/event/:eventId',
  validateRequest({ params: eventIdParamSchema }),
  SponsorController.getEventSponsors
);

// Create company brand profile (organization level)
router.post(
  '/profiles',
  authenticate,
  validateRequest({ body: createSponsorProfileSchema }),
  SponsorController.createProfile
);

// Create sponsorship package tier for an event
router.post(
  '/packages',
  authenticate,
  requireEventRole('event_organizer'),
  validateRequest({ body: createSponsorPackageSchema }),
  SponsorController.createPackage
);

// Allocate sponsorship to profile with atomic slot control
router.post(
  '/partnerships',
  authenticate,
  requireEventRole('event_organizer'),
  validateRequest({ body: allocateSponsorshipSchema }),
  SponsorController.allocateSponsorship
);

// Update deliverable submission/approval/rejection status
router.put(
  '/deliverables/:id',
  authenticate,
  validateRequest({ body: updateDeliverableStatusSchema }),
  SponsorController.updateDeliverable
);

export default router;
