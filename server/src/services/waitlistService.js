import Registration from '../models/Registration.js';
import TicketTier from '../models/TicketTier.js';
import { AppError } from '../utils/AppError.js';
import { HOLD_TYPES, WAITLIST_CLAIM_HOLD_HOURS, REGISTRATION_STATUS, PAYMENT_STATUS } from '../utils/constants.js';

export class WaitlistService {
  /**
   * User joins the waitlist for a sold-out ticket tier.
   */
  static async joinWaitlist({ eventId, userId, ticketTierId, quantity = 1, attendeeDetails }) {
    const tier = await TicketTier.findById(ticketTierId);
    if (!tier || !tier.isActive || tier.eventRef.toString() !== eventId.toString()) {
      throw new AppError('Ticket tier not found or inactive for this event.', 404, 'TIER_NOT_FOUND');
    }

    if (quantity < 1 || quantity > tier.maxPerOrder) {
      throw new AppError(`Waitlist quantity must be between 1 and ${tier.maxPerOrder}.`, 400, 'INVALID_TICKET_QUANTITY');
    }

    // Active registration guard: user cannot hold an active ticket or reservation for this event
    const activeReg = await Registration.findOne({
      eventRef: eventId,
      userRef: userId,
      status: { $in: [REGISTRATION_STATUS.HELD, REGISTRATION_STATUS.CONFIRMED, REGISTRATION_STATUS.PENDING_APPROVAL] }
    });

    if (activeReg) {
      throw new AppError(
        'You cannot join the waitlist while holding an active registration or reservation for this event.',
        409,
        'DUPLICATE_ACTIVE_REGISTRATION'
      );
    }

    // Active waitlist guard: user cannot occupy multiple waitlist spots for the same tier
    const existingWaitlist = await Registration.findOne({
      eventRef: eventId,
      userRef: userId,
      ticketTierRef: ticketTierId,
      status: REGISTRATION_STATUS.WAITLISTED
    });

    if (existingWaitlist) {
      throw new AppError('You are already on the waitlist for this ticket tier.', 409, 'ALREADY_WAITLISTED');
    }

    const activeWaitlistCount = await Registration.countDocuments({
      ticketTierRef: ticketTierId,
      status: REGISTRATION_STATUS.WAITLISTED
    });

    const registrationNumber = `EF-WL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Build passes placeholder
    const attendeePasses = [];
    for (let i = 1; i <= quantity; i++) {
      attendeePasses.push({
        passNumber: `${registrationNumber}-${i}`,
        holderName:
          i === 1
            ? `${attendeeDetails.firstName} ${attendeeDetails.lastName}`
            : `Guest ${i} of ${attendeeDetails.firstName}`,
        holderEmail: i === 1 ? attendeeDetails.email : `guest${i}_${attendeeDetails.email}`,
        qrCodePayload: null,
        checkedIn: false
      });
    }

    const registration = await Registration.create({
      eventRef: eventId,
      userRef: userId,
      ticketTierRef: ticketTierId,
      registrationNumber,
      quantity,
      status: REGISTRATION_STATUS.WAITLISTED,
      holdType: null,
      paymentStatus: PAYMENT_STATUS.UNPAID,
      waitlistPosition: activeWaitlistCount + 1,
      waitlistJoinedAt: new Date(),
      attendeeDetails,
      attendeePasses
    });

    return registration;
  }

  /**
   * Promotes the next waitlisted user in strict FIFO order upon inventory release.
   */
  static async promoteNextInQueue(ticketTierId) {
    // Deterministic FIFO: oldest joined active waitlist entry
    const nextInLine = await Registration.findOne({
      ticketTierRef: ticketTierId,
      status: REGISTRATION_STATUS.WAITLISTED
    })
      .sort({ waitlistJoinedAt: 1, waitlistPosition: 1 })
      .populate('userRef', 'name email');

    if (!nextInLine) return null;

    // Atomically reserve inventory for the waitlist claim
    const tier = await TicketTier.findOneAndUpdate(
      {
        _id: ticketTierId,
        $expr: {
          $gte: [
            { $subtract: ['$totalQuantity', { $add: ['$soldQuantity', '$reservedQuantity'] }] },
            nextInLine.quantity
          ]
        }
      },
      { $inc: { reservedQuantity: nextInLine.quantity } },
      { returnDocument: 'after' }
    );

    if (!tier) return null; // Inventory insufficient for this claim's quantity

    // Grant 24-hour exclusive claim window
    nextInLine.status = REGISTRATION_STATUS.HELD;
    nextInLine.holdType = HOLD_TYPES.WAITLIST_CLAIM;
    nextInLine.holdExpiresAt = new Date(Date.now() + WAITLIST_CLAIM_HOLD_HOURS * 60 * 60 * 1000);
    nextInLine.waitlistPosition = null;
    await nextInLine.save();

    return nextInLine;
  }

  /**
   * Attendee cancels their waitlist spot.
   */
  static async leaveWaitlist(registrationId, user) {
    const reg = await Registration.findById(registrationId);
    if (!reg) throw new AppError('Waitlist registration not found.', 404, 'NOT_FOUND');

    if (user.globalRole !== 'platform_admin' && reg.userRef.toString() !== user._id.toString()) {
      throw new AppError('Forbidden: You can only cancel your own waitlist entries.', 403, 'FORBIDDEN');
    }

    if (reg.status !== REGISTRATION_STATUS.WAITLISTED) {
      throw new AppError('Registration is not in active waitlist status.', 400, 'INVALID_STATUS');
    }

    reg.status = REGISTRATION_STATUS.CANCELLED;
    reg.waitlistPosition = null;
    await reg.save();

    return { success: true, message: 'Successfully removed from waitlist.' };
  }

  /**
   * Organizer view of the waitlist queue for an event.
   */
  static async getWaitlistByEvent(eventId) {
    return Registration.find({
      eventRef: eventId,
      status: REGISTRATION_STATUS.WAITLISTED
    })
      .populate('userRef', 'name email')
      .populate('ticketTierRef', 'name price')
      .sort({ ticketTierRef: 1, waitlistJoinedAt: 1, waitlistPosition: 1 });
  }
}
