import { SpeakerService } from '../services/speakerService.js';

export class SpeakerController {
  static async createSpeaker(req, res, next) {
    try {
      const speaker = await SpeakerService.createSpeaker(req.body);
      res.status(201).json({
        success: true,
        data: { speaker }
      });
    } catch (err) {
      next(err);
    }
  }

  static async listSpeakersByEvent(req, res, next) {
    try {
      const speakers = await SpeakerService.listSpeakersByEvent(req.params.eventId);
      res.status(200).json({
        success: true,
        data: { speakers }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getSpeaker(req, res, next) {
    try {
      const speaker = await SpeakerService.getSpeakerById(req.params.id);
      res.status(200).json({
        success: true,
        data: { speaker }
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateSpeaker(req, res, next) {
    try {
      const speaker = await SpeakerService.updateSpeaker(req.params.id, req.body, req.user);
      res.status(200).json({
        success: true,
        data: { speaker }
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteSpeaker(req, res, next) {
    try {
      const result = await SpeakerService.deleteSpeaker(req.params.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
