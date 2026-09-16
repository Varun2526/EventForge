import { SessionService } from '../services/sessionService.js';

export class SessionController {
  static async createSession(req, res, next) {
    try {
      const session = await SessionService.createSession(req.body);
      res.status(201).json({
        success: true,
        data: { session }
      });
    } catch (err) {
      next(err);
    }
  }

  static async listSessionsByEvent(req, res, next) {
    try {
      const sessions = await SessionService.listSessionsByEvent(req.params.eventId, req.query);
      res.status(200).json({
        success: true,
        data: { sessions }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getSession(req, res, next) {
    try {
      const session = await SessionService.getSessionById(req.params.id);
      res.status(200).json({
        success: true,
        data: { session }
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateSession(req, res, next) {
    try {
      const session = await SessionService.updateSession(req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: { session }
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteSession(req, res, next) {
    try {
      const result = await SessionService.cancelSession(req.params.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
