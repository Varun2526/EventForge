import Registration from '../models/Registration.js';
import { TicketInventoryEngine } from '../services/ticketInventoryEngine.js';
import { WaitlistService } from '../services/waitlistService.js';
import { AppError } from '../utils/AppError.js';

export class RegistrationController {
  static async holdTicket(req, res, next) {
    try {
      const result = await TicketInventoryEngine.holdTicket({
        eventId: req.body.eventId,
        userId: req.user._id,
        ticketTierId: req.body.ticketTierId,
        quantity: req.body.quantity,
        couponCode: req.body.couponCode,
        attendeeDetails: req.body.attendeeDetails
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async joinWaitlist(req, res, next) {
    try {
      const registration = await WaitlistService.joinWaitlist({
        eventId: req.body.eventId,
        userId: req.user._id,
        ticketTierId: req.body.ticketTierId,
        quantity: req.body.quantity,
        attendeeDetails: req.body.attendeeDetails
      });

      res.status(201).json({
        success: true,
        data: { registration }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getWaitlistByEvent(req, res, next) {
    try {
      const waitlist = await WaitlistService.getWaitlistByEvent(req.params.eventId);
      res.status(200).json({
        success: true,
        data: { waitlist }
      });
    } catch (err) {
      next(err);
    }
  }

  static async leaveWaitlist(req, res, next) {
    try {
      const result = await WaitlistService.leaveWaitlist(req.params.registrationId, req.user);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMyTickets(req, res, next) {
    try {
      const registrations = await Registration.find({
        userRef: req.user._id,
        status: { $in: ['confirmed', 'held'] }
      })
        .populate('eventRef', 'title slug startDate endDate timezone coverImageUrl venueRef')
        .populate('ticketTierRef', 'name price currency accessLevel')
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: { registrations }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getEventRegistrations(req, res, next) {
    try {
      const registrations = await Registration.find({ eventRef: req.params.eventId })
        .populate('userRef', 'name email')
        .populate('ticketTierRef', 'name price')
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: { registrations }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRegistration(req, res, next) {
    try {
      const registration = await Registration.findById(req.params.id)
        .populate('eventRef', 'title slug startDate endDate timezone')
        .populate('ticketTierRef', 'name price currency perks accessLevel');

      if (!registration) throw new AppError('Registration not found.', 404, 'NOT_FOUND');

      const isOwner = req.user && registration.userRef.toString() === req.user._id.toString();
      const isPlatformAdmin = req.user && req.user.globalRole === 'platform_admin';

      if (!isOwner && !isPlatformAdmin) {
        throw new AppError('Forbidden: You do not have permission to view this registration.', 403, 'FORBIDDEN');
      }

      res.status(200).json({
        success: true,
        data: { registration }
      });
    } catch (err) {
      next(err);
    }
  }
}
