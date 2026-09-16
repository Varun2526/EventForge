import mongoose from 'mongoose';
import Registration from '../models/Registration.js';
import TicketTier from '../models/TicketTier.js';
import Coupon from '../models/Coupon.js';
import { WaitlistService } from '../services/waitlistService.js';
import { REGISTRATION_STATUS, PAYMENT_STATUS } from '../utils/constants.js';


export const expireTicketHoldsJob = async () => {
  const expiredCandidates = await Registration.find({
    status: REGISTRATION_STATUS.HELD,
    holdExpiresAt: { $lt: new Date() }
  }).select('_id ticketTierRef quantity couponRef holdType');

  let expiredCount = 0;

  for (const candidate of expiredCandidates) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // INVARIANT: State guard - conditionally transition HELD -> EXPIRED
      const reg = await Registration.findOneAndUpdate(
        {
          _id: candidate._id,
          status: REGISTRATION_STATUS.HELD,
          holdExpiresAt: { $lt: new Date() }
        },
        {
          $set: {
            status: REGISTRATION_STATUS.EXPIRED,
            paymentStatus: PAYMENT_STATUS.FAILED,
            holdType: null
          }
        },
        { returnDocument: 'after', session }
      );

      if (!reg) {
        // Confirmation won the race and updated status to confirmed!
        await session.abortTransaction();
        continue;
      }

      // Release reserved inventory
      await TicketTier.findByIdAndUpdate(
        reg.ticketTierRef,
        { $inc: { reservedQuantity: -reg.quantity } },
        { session }
      );

      // Release reserved coupon usage
      if (reg.couponRef) {
        await Coupon.findByIdAndUpdate(
          reg.couponRef,
          { $inc: { reservedUses: -1 } },
          { session }
        );
      }

      await session.commitTransaction();
      expiredCount++;

      // Trigger waitlist cascade
      await WaitlistService.promoteNextInQueue(reg.ticketTierRef);
    } catch (err) {
      await session.abortTransaction();
      // Continue loop for remaining candidates
    } finally {
      session.endSession();
    }
  }

  return { candidatesFound: expiredCandidates.length, expiredCount };
};
