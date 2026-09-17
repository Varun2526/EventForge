import { AIGenerativeService } from '../services/aiGenerativeService.js';
import { AISessionRecommendationEngine } from '../services/aiSessionRecommendationEngine.js';

export class AIController {
  /**
   * Generates event marketing copy, executive summary, and tags.
   */
  static async generateEventCopy(req, res, next) {
    try {
      const copy = await AIGenerativeService.generateEventCopy({
        ...req.body,
        operatorUser: req.user
      });

      res.status(200).json({
        success: true,
        message: 'Event copy generated successfully.',
        data: copy
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Polishes speaker bios and headlines.
   */
  static async generateSpeakerBio(req, res, next) {
    try {
      const bio = await AIGenerativeService.generateSpeakerBio({
        ...req.body,
        operatorUser: req.user
      });

      res.status(200).json({
        success: true,
        message: 'Speaker bio generated successfully.',
        data: bio
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Generates targeted multi-channel event announcements.
   */
  static async generateAnnouncement(req, res, next) {
    try {
      const announcement = await AIGenerativeService.generateAnnouncement({
        ...req.body,
        operatorUser: req.user
      });

      res.status(200).json({
        success: true,
        message: 'Announcement generated successfully.',
        data: announcement
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Generates personalized, conflict-aware session recommendations for an attendee.
   */
  static async getRecommendations(req, res, next) {
    try {
      const recommendations = await AISessionRecommendationEngine.getRecommendations({
        eventId: req.params.eventId,
        userId: req.user._id
      });

      res.status(200).json({
        success: true,
        message: 'Session recommendations generated successfully.',
        data: recommendations
      });
    } catch (err) {
      next(err);
    }
  }
}
