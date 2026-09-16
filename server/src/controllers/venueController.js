import { VenueService } from '../services/venueService.js';

export class VenueController {
  static async createVenue(req, res, next) {
    try {
      const venue = await VenueService.createVenue(req.body, req.user);
      res.status(201).json({
        success: true,
        data: { venue }
      });
    } catch (err) {
      next(err);
    }
  }

  static async listVenues(req, res, next) {
    try {
      const venues = await VenueService.listVenues(req.query, req.user);
      res.status(200).json({
        success: true,
        data: { venues }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getVenue(req, res, next) {
    try {
      const venue = await VenueService.getVenueById(req.params.id);
      res.status(200).json({
        success: true,
        data: { venue }
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateVenue(req, res, next) {
    try {
      const venue = await VenueService.updateVenue(req.params.id, req.body, req.user);
      res.status(200).json({
        success: true,
        data: { venue }
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteVenue(req, res, next) {
    try {
      const result = await VenueService.deleteVenue(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // --- Room Sub-resource Handlers ---

  static async addRoom(req, res, next) {
    try {
      const room = await VenueService.addRoom(req.params.venueId, req.body, req.user);
      res.status(201).json({
        success: true,
        data: { room }
      });
    } catch (err) {
      next(err);
    }
  }

  static async listRooms(req, res, next) {
    try {
      const rooms = await VenueService.listRooms(req.params.venueId);
      res.status(200).json({
        success: true,
        data: { rooms }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRoom(req, res, next) {
    try {
      const room = await VenueService.getRoomById(req.params.venueId, req.params.roomId);
      res.status(200).json({
        success: true,
        data: { room }
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateRoom(req, res, next) {
    try {
      const room = await VenueService.updateRoom(req.params.venueId, req.params.roomId, req.body, req.user);
      res.status(200).json({
        success: true,
        data: { room }
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteRoom(req, res, next) {
    try {
      const result = await VenueService.deleteRoom(req.params.venueId, req.params.roomId, req.user);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
