import mongoose from 'mongoose';
import TicketTier from '../models/TicketTier.js';
import Registration from '../models/Registration.js';
import Coupon from '../models/Coupon.js';
import { QRVerificationEngine } from './qrVerificationEngine.js';
import { AppError } from '../utils/AppError.js';
import { HOLD_TYPES, CHECKOUT_HOLD_MINUTES, REGISTRATION_STATUS, PAYMENT_STATUS } from '../utils/constants.js';

export class TicketInventoryEngine {
  /**
   * Phase 1: Hold ticket inventory for requested quantity.
   * Atomically reserves inventory and coupon usage in a MongoDB transaction.
   */
  static async holdTicket({ eventId, userId, ticketTierId, quantity = 1, couponCode, attendeeDetails }) {
    // 1. Initial validations outside transaction
    const tier = await TicketTier.findById(ticketTierId);
    if (!tier || !tier.isActive || tier.eventRef.toString() !== eventId.toString()) {
      throw new AppError('Ticket tier not found or inactive for this event.', 404, 'TIER_NOT_FOUND');
    }

    const now = new Date();
    if (now < new Date(tier.salesStart) || now > new Date(tier.salesEnd)) {
      throw new AppError('Ticket sales are not currently open for this tier.', 400, 'SALES_WINDOW_CLOSED');
    }

    if (quantity < 1 || quantity > tier.maxPerOrder) {
      throw new AppError(`Quantity must be between 1 and ${tier.maxPerOrder}.`, 400, 'INVALID_TICKET_QUANTITY');
    }

    // 2. Active registration check (User can only have one active registration per event)
    const existingActiveReg = await Registration.findOne({
      eventRef: eventId,
      userRef: userId,
      status: { $in: [REGISTRATION_STATUS.HELD, REGISTRATION_STATUS.CONFIRMED, REGISTRATION_STATUS.PENDING_APPROVAL] }
    });

    if (existingActiveReg) {
      throw new AppError(
        'You already hold an active registration or reservation for this event.',
        409,
        'DUPLICATE_ACTIVE_REGISTRATION'
      );
    }

    // 3. Start Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Step A: Atomic capacity check & reservation for requested quantity
      const updatedTier = await TicketTier.findOneAndUpdate(
        {
          _id: ticketTierId,
          eventRef: eventId,
          isActive: true,
          $expr: {
            $gte: [
              { $subtract: ['$totalQuantity', { $add: ['$soldQuantity', '$reservedQuantity'] }] },
              quantity
            ]
          }
        },
        { $inc: { reservedQuantity: quantity } },
        { returnDocument: 'after', session }
      );

      if (!updatedTier) {
        throw new AppError('Requested ticket quantity is no longer available.', 409, 'TICKET_SOLD_OUT');
      }

      // Step B: Atomic 2-Phase Coupon Reservation
      let finalPricePerTicket = updatedTier.price;
      let couponDoc = null;

      if (couponCode) {
        const cleanCode = couponCode.toUpperCase().trim();
        couponDoc = await Coupon.findOneAndUpdate(
          {
            eventRef: eventId,
            code: cleanCode,
            isActive: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now },
            $expr: { $lt: [{ $add: ['$usedCount', '$reservedUses'] }, '$maxUses'] }
          },
          { $inc: { reservedUses: 1 } },
          { returnDocument: 'after', session }
        );

        if (!couponDoc) {
          throw new AppError('Coupon code is invalid, expired, or exhausted.', 400, 'COUPON_EXHAUSTED');
        }

        // Apply discount
        if (couponDoc.discountType === 'percentage') {
          finalPricePerTicket -= (finalPricePerTicket * couponDoc.discountValue) / 100;
        } else {
          finalPricePerTicket = Math.max(0, finalPricePerTicket - couponDoc.discountValue / quantity);
        }
      }

      const totalAmount = Math.max(0, Math.round(finalPricePerTicket * quantity * 100) / 100);
      const registrationNumber = `EF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Step C: Build individual attendee passes
      const attendeePasses = [];
      for (let i = 1; i <= quantity; i++) {
        attendeePasses.push({
          passNumber: `${registrationNumber}-${i}`,
          holderName:
            i === 1
              ? `${attendeeDetails.firstName} ${attendeeDetails.lastName}`
              : `Guest ${i} of ${attendeeDetails.firstName}`,
          holderEmail: i === 1 ? attendeeDetails.email : `guest${i}_${attendeeDetails.email}`,
          qrCodePayload: null, // Minted only upon confirmation
          checkedIn: false
        });
      }

      // Step D: If Free ($0), immediately confirm and mint badges
      if (totalAmount === 0) {
        await TicketTier.findByIdAndUpdate(
          ticketTierId,
          { $inc: { reservedQuantity: -quantity, soldQuantity: quantity } },
          { session }
        );

        if (couponDoc) {
          await Coupon.findByIdAndUpdate(
            couponDoc._id,
            { $inc: { reservedUses: -1, usedCount: 1 } },
            { session }
          );
        }

        // Mint badges for each pass
        attendeePasses.forEach((pass) => {
          pass.qrCodePayload = QRVerificationEngine.signBadgeToken({
            passNumber: pass.passNumber,
            regNum: registrationNumber,
            eventId,
            userId,
            tierId: ticketTierId
          });
        });

        const [registration] = await Registration.create(
          [
            {
              eventRef: eventId,
              userRef: userId,
              ticketTierRef: ticketTierId,
              registrationNumber,
              quantity,
              status: REGISTRATION_STATUS.CONFIRMED,
              holdType: null,
              paymentStatus: PAYMENT_STATUS.FREE,
              totalAmountPaid: 0,
              couponRef: couponDoc?._id || null,
              attendeeDetails,
              attendeePasses
            }
          ],
          { session }
        );

        await session.commitTransaction();
        return { status: REGISTRATION_STATUS.CONFIRMED, registration };
      }

      // Step E: Paid Ticket: Hold for 15 minutes
      const holdExpiresAt = new Date(Date.now() + CHECKOUT_HOLD_MINUTES * 60 * 1000);

      const [registration] = await Registration.create(
        [
          {
            eventRef: eventId,
            userRef: userId,
            ticketTierRef: ticketTierId,
            registrationNumber,
            quantity,
            status: REGISTRATION_STATUS.HELD,
            holdType: HOLD_TYPES.CHECKOUT,
            paymentStatus: PAYMENT_STATUS.PENDING,
            holdExpiresAt,
            totalAmountPaid: totalAmount,
            couponRef: couponDoc?._id || null,
            attendeeDetails,
            attendeePasses
          }
        ],
        { session }
      );

      await session.commitTransaction();
      return { status: REGISTRATION_STATUS.HELD, holdExpiresAt, registration };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Phase 2: Transactional State Transition out of 'held' into 'confirmed'
   */
  static async confirmPayment({ registrationId, paymentIntentId }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // INVARIANT: Exactly one transition out of 'held'
      const reg = await Registration.findOneAndUpdate(
        {
          _id: registrationId,
          status: REGISTRATION_STATUS.HELD,
          holdExpiresAt: { $gte: new Date() } // Concurrency Guard against expired holds
        },
        {
          $set: {
            status: REGISTRATION_STATUS.CONFIRMED,
            paymentStatus: PAYMENT_STATUS.PAID,
            paymentIntentId,
            holdExpiresAt: null,
            holdType: null
          }
        },
        { returnDocument: 'after', session }
      );

      if (!reg) {
        // If not found, check if already confirmed (idempotent replay)
        const alreadyConfirmed = await Registration.findOne({
          _id: registrationId,
          status: REGISTRATION_STATUS.CONFIRMED
        }).session(session);

        if (alreadyConfirmed) {
          await session.abortTransaction();
          return alreadyConfirmed;
        }
        throw new AppError('Ticket hold has expired or was already cancelled.', 410, 'TICKET_HOLD_EXPIRED');
      }

      // Adjust inventory
      await TicketTier.findByIdAndUpdate(
        reg.ticketTierRef,
        { $inc: { reservedQuantity: -reg.quantity, soldQuantity: reg.quantity } },
        { session }
      );

      // Finalize coupon consumption
      if (reg.couponRef) {
        await Coupon.findByIdAndUpdate(
          reg.couponRef,
          { $inc: { reservedUses: -1, usedCount: 1 } },
          { session }
        );
      }

      // Mint QR badges for each pass
      reg.attendeePasses.forEach((pass) => {
        pass.qrCodePayload = QRVerificationEngine.signBadgeToken({
          passNumber: pass.passNumber,
          regNum: reg.registrationNumber,
          eventId: reg.eventRef,
          userId: reg.userRef,
          tierId: reg.ticketTierRef
        });
      });

      await reg.save({ session });
      await session.commitTransaction();

      return reg;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}
