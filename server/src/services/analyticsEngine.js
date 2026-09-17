import mongoose from 'mongoose';
import Registration from '../models/Registration.js';
import Session from '../models/Session.js';
import Sponsorship from '../models/Sponsorship.js';
import Feedback from '../models/Feedback.js';
import { verifyOperatorEventAccess } from './checkInService.js';
import { AppError } from '../utils/AppError.js';

export class AnalyticsEngine {
  /**
   * High-level event KPIs (sums quantity for accurate ticket volume and gross revenue).
   * Strictly read-only aggregation.
   */
  static async getEventSummaryKPIs(eventId, operatorUser) {
    if (!eventId) throw new AppError('Event ID is required.', 400, 'BAD_REQUEST');
    await verifyOperatorEventAccess(operatorUser, eventId);

    const eventObjId = new mongoose.Types.ObjectId(eventId);

    // 1. Registration and revenue aggregations
    const [regStats = {}] = await Registration.aggregate([
      { $match: { eventRef: eventObjId } },
      {
        $group: {
          _id: null,
          totalRegistrations: { $sum: 1 },
          confirmedRegistrations: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          waitlistedRegistrations: {
            $sum: { $cond: [{ $eq: ['$status', 'waitlisted'] }, 1, 0] }
          },
          heldRegistrations: {
            $sum: { $cond: [{ $eq: ['$status', 'held'] }, 1, 0] }
          },
          cancelledRegistrations: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          totalTicketsSold: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$quantity', 0] }
          },
          grossRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'confirmed'] },
                { $ifNull: ['$totalAmountPaid', { $ifNull: ['$finalAmount', 0] }] },
                0
              ]
            }
          }
        }
      }
    ]);

    // 2. Pass and check-in aggregations
    const [passStats = {}] = await Registration.aggregate([
      { $match: { eventRef: eventObjId, status: 'confirmed' } },
      { $unwind: '$attendeePasses' },
      {
        $group: {
          _id: null,
          totalPasses: { $sum: 1 },
          checkedInPasses: {
            $sum: { $cond: [{ $eq: ['$attendeePasses.checkedIn', true] }, 1, 0] }
          }
        }
      }
    ]);

    const totalPasses = passStats.totalPasses || 0;
    const checkedInPasses = passStats.checkedInPasses || 0;
    const checkInRate = totalPasses > 0 ? Number(((checkedInPasses / totalPasses) * 100).toFixed(1)) : 0;

    return {
      eventId,
      summary: {
        totalRegistrations: regStats.totalRegistrations || 0,
        confirmedRegistrations: regStats.confirmedRegistrations || 0,
        waitlistedRegistrations: regStats.waitlistedRegistrations || 0,
        heldRegistrations: regStats.heldRegistrations || 0,
        cancelledRegistrations: regStats.cancelledRegistrations || 0,
        totalTicketsSold: regStats.totalTicketsSold || 0,
        grossRevenue: regStats.grossRevenue || 0,
        totalPasses,
        checkedInPasses,
        checkInRate
      }
    };
  }

  /**
   * Room utilization, attendance, and session popularity rankings.
   */
  static async getSessionHeatmaps(eventId, operatorUser) {
    if (!eventId) throw new AppError('Event ID is required.', 400, 'BAD_REQUEST');
    await verifyOperatorEventAccess(operatorUser, eventId);

    const eventObjId = new mongoose.Types.ObjectId(eventId);

    const heatmaps = await Session.aggregate([
      { $match: { eventRef: eventObjId } },
      {
        $lookup: {
          from: 'sessionattendances',
          localField: '_id',
          foreignField: 'sessionRef',
          as: 'attendanceRecords'
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          roomName: 1,
          track: 1,
          startTime: 1,
          endTime: 1,
          capacityLimit: 1,
          enrolledCount: 1,
          actualAttendanceCount: { $size: '$attendanceRecords' },
          utilizationRate: {
            $cond: [
              { $gt: ['$capacityLimit', 0] },
              { $round: [{ $multiply: [{ $divide: ['$enrolledCount', '$capacityLimit'] }, 100] }, 1] },
              0
            ]
          }
        }
      },
      { $sort: { enrolledCount: -1, startTime: 1 } }
    ]);

    return {
      eventId,
      totalSessions: heatmaps.length,
      sessions: heatmaps
    };
  }

  /**
   * Sponsor fulfillment, package distribution, and deliverable status metrics.
   */
  static async getSponsorMetrics(eventId, operatorUser) {
    if (!eventId) throw new AppError('Event ID is required.', 400, 'BAD_REQUEST');
    await verifyOperatorEventAccess(operatorUser, eventId);

    const eventObjId = new mongoose.Types.ObjectId(eventId);

    const [summary = {}] = await Sponsorship.aggregate([
      { $match: { eventRef: eventObjId } },
      {
        $group: {
          _id: null,
          totalSponsorships: { $sum: 1 },
          totalRevenue: { $sum: '$amountPaid' }
        }
      }
    ]);

    const deliverableStats = await Sponsorship.aggregate([
      { $match: { eventRef: eventObjId } },
      { $unwind: '$deliverables' },
      {
        $group: {
          _id: '$deliverables.status',
          count: { $sum: 1 }
        }
      }
    ]);

    const breakdown = {
      pending: 0,
      submitted: 0,
      approved: 0,
      rejected: 0
    };

    let totalDeliverables = 0;
    for (const stat of deliverableStats) {
      if (breakdown[stat._id] !== undefined) {
        breakdown[stat._id] = stat.count;
      }
      totalDeliverables += stat.count;
    }

    const fulfillmentRate =
      totalDeliverables > 0 ? Number(((breakdown.approved / totalDeliverables) * 100).toFixed(1)) : 0;

    return {
      eventId,
      sponsorships: {
        totalSponsors: summary.totalSponsorships || 0,
        totalRevenue: summary.totalRevenue || 0,
        totalDeliverables,
        deliverablesBreakdown: breakdown,
        fulfillmentRate
      }
    };
  }

  /**
   * CSAT ratings, sentiment distribution, and dimensional quality scoring.
   */
  static async getFeedbackAnalytics(eventId, operatorUser) {
    if (!eventId) throw new AppError('Event ID is required.', 400, 'BAD_REQUEST');
    await verifyOperatorEventAccess(operatorUser, eventId);

    const eventObjId = new mongoose.Types.ObjectId(eventId);

    const [overall = {}] = await Feedback.aggregate([
      { $match: { eventRef: eventObjId } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          averageSentiment: { $avg: '$sentimentScore' },
          avgContentQuality: { $avg: '$dimensions.contentQuality' },
          avgSpeakerClarity: { $avg: '$dimensions.speakerClarity' },
          avgVenueEnvironment: { $avg: '$dimensions.venueEnvironment' }
        }
      }
    ]);

    const ratingDistribution = await Feedback.aggregate([
      { $match: { eventRef: eventObjId } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const ratingsMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratingDistribution) {
      ratingsMap[r._id] = r.count;
    }

    return {
      eventId,
      feedback: {
        totalReviews: overall.totalReviews || 0,
        averageRating: overall.averageRating ? Number(overall.averageRating.toFixed(2)) : 0,
        averageSentiment: overall.averageSentiment ? Number(overall.averageSentiment.toFixed(2)) : 0,
        ratingDistribution: ratingsMap,
        dimensions: {
          contentQuality: overall.avgContentQuality ? Number(overall.avgContentQuality.toFixed(2)) : 0,
          speakerClarity: overall.avgSpeakerClarity ? Number(overall.avgSpeakerClarity.toFixed(2)) : 0,
          venueEnvironment: overall.avgVenueEnvironment ? Number(overall.avgVenueEnvironment.toFixed(2)) : 0
        }
      }
    };
  }
}
