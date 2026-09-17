import { AnalyticsEngine } from '../services/analyticsEngine.js';

export class AnalyticsController {
  /**
   * Retrieves high-level event KPIs (ticket volume, revenue, check-in rate).
   */
  static async getSummary(req, res, next) {
    try {
      const summary = await AnalyticsEngine.getEventSummaryKPIs(req.params.eventId, req.user);
      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves session heatmaps, room utilization, and popularity ranks.
   */
  static async getHeatmaps(req, res, next) {
    try {
      const heatmaps = await AnalyticsEngine.getSessionHeatmaps(req.params.eventId, req.user);
      res.status(200).json({
        success: true,
        data: heatmaps
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves sponsor ROI and deliverable fulfillment metrics.
   */
  static async getSponsors(req, res, next) {
    try {
      const sponsors = await AnalyticsEngine.getSponsorMetrics(req.params.eventId, req.user);
      res.status(200).json({
        success: true,
        data: sponsors
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves feedback analytics, CSAT, sentiment, and dimension ratings.
   */
  static async getFeedback(req, res, next) {
    try {
      const feedback = await AnalyticsEngine.getFeedbackAnalytics(req.params.eventId, req.user);
      res.status(200).json({
        success: true,
        data: feedback
      });
    } catch (err) {
      next(err);
    }
  }
}
