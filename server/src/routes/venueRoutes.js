import { Router } from 'express';
import { VenueController } from '../controllers/venueController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createVenueSchema, updateVenueSchema, roomSchema } from '../validators/venueValidator.js';

const router = Router();

// All venue management endpoints require authentication
router.use(authenticate);

router.get('/', VenueController.listVenues);
router.post('/', validateRequest({ body: createVenueSchema }), VenueController.createVenue);
router.get('/:id', VenueController.getVenue);
router.put('/:id', validateRequest({ body: updateVenueSchema }), VenueController.updateVenue);
router.delete('/:id', VenueController.deleteVenue);

// Embedded Room Management Endpoints
router.post('/:venueId/rooms', validateRequest({ body: roomSchema }), VenueController.addRoom);
router.get('/:venueId/rooms', VenueController.listRooms);
router.get('/:venueId/rooms/:roomId', VenueController.getRoom);
router.put('/:venueId/rooms/:roomId', validateRequest({ body: roomSchema.partial() }), VenueController.updateRoom);
router.delete('/:venueId/rooms/:roomId', VenueController.deleteRoom);

export default router;
