import { EventService } from '../services/eventService.js';

export class EventController {
  static async createEvent(req, res, next) {
    try {
      const event = await EventService.createEvent(req.body, req.user);
      res.status(201).json({
        success: true,
        data: { event }
      });
    } catch (err) {
      next(err);
    }
  }

  static async listEvents(req, res, next) {
    try {
      const result = await EventService.listEvents(req.query, req.user);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async getEvent(req, res, next) {
    try {
      const event = await EventService.getEventByIdOrSlug(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: { event }
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateEvent(req, res, next) {
    try {
      const event = await EventService.updateEvent(req.params.id, req.body, req.user);
      res.status(200).json({
        success: true,
        data: { event }
      });
    } catch (err) {
      next(err);
    }
  }

  static async publishEvent(req, res, next) {
    try {
      const event = await EventService.publishEvent(req.params.id);
      res.status(200).json({
        success: true,
        data: { event }
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteEvent(req, res, next) {
    try {
      const result = await EventService.cancelEvent(req.params.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
