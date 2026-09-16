import TicketTier from '../models/TicketTier.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import { AppError } from '../utils/AppError.js';

export class TicketController {
  static async listTicketsByEvent(req, res, next) {
    try {
      const { eventId } = req.params;
      const tiers = await TicketTier.find({ eventRef: eventId, isActive: true }).sort({ price: 1 });
      res.status(200).json({
        success: true,
        data: { ticketTiers: tiers }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTicketTier(req, res, next) {
    try {
      const tier = await TicketTier.findById(req.params.id);
      if (!tier) throw new AppError('Ticket tier not found.', 404, 'NOT_FOUND');
      res.status(200).json({
        success: true,
        data: { ticketTier: tier }
      });
    } catch (err) {
      next(err);
    }
  }

  static async createTicketTier(req, res, next) {
    try {
      const event = await Event.findById(req.body.eventRef);
      if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

      const tier = await TicketTier.create(req.body);
      res.status(201).json({
        success: true,
        data: { ticketTier: tier }
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateTicketTier(req, res, next) {
    try {
      const tier = await TicketTier.findById(req.params.id);
      if (!tier) throw new AppError('Ticket tier not found.', 404, 'NOT_FOUND');

      Object.assign(tier, req.body);
      await tier.save();

      res.status(200).json({
        success: true,
        data: { ticketTier: tier }
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteTicketTier(req, res, next) {
    try {
      const tier = await TicketTier.findById(req.params.id);
      if (!tier) throw new AppError('Ticket tier not found.', 404, 'NOT_FOUND');

      const activeRegistrations = await Registration.countDocuments({
        ticketTierRef: tier._id,
        status: { $in: ['held', 'confirmed'] }
      });

      if (activeRegistrations > 0) {
        throw new AppError('Cannot delete ticket tier with active registrations or holds.', 400, 'TIER_IN_USE');
      }

      tier.isActive = false;
      await tier.save();

      res.status(200).json({
        success: true,
        message: 'Ticket tier archived successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
}
