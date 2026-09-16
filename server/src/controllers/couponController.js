import Coupon from '../models/Coupon.js';
import Event from '../models/Event.js';
import { AppError } from '../utils/AppError.js';

export class CouponController {
  static async validateCoupon(req, res, next) {
    try {
      const { eventId, code } = req.body;
      const cleanCode = code.toUpperCase().trim();
      const now = new Date();

      const coupon = await Coupon.findOne({
        eventRef: eventId,
        code: cleanCode,
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now }
      });

      if (!coupon) {
        throw new AppError('Coupon code is invalid, expired, or not applicable to this event.', 404, 'COUPON_NOT_FOUND');
      }

      if (coupon.usedCount + coupon.reservedUses >= coupon.maxUses) {
        throw new AppError('Coupon has reached its maximum usage limit.', 400, 'COUPON_EXHAUSTED');
      }

      res.status(200).json({
        success: true,
        data: {
          coupon: {
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            minOrderAmount: coupon.minOrderAmount,
            applicableTierRefs: coupon.applicableTierRefs
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async createCoupon(req, res, next) {
    try {
      const event = await Event.findById(req.body.eventRef);
      if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

      const cleanCode = req.body.code.toUpperCase().trim();
      const existing = await Coupon.findOne({ eventRef: req.body.eventRef, code: cleanCode });
      if (existing) {
        throw new AppError('A coupon with this code already exists for this event.', 409, 'CONFLICT');
      }

      const coupon = await Coupon.create({
        ...req.body,
        code: cleanCode
      });

      res.status(201).json({
        success: true,
        data: { coupon }
      });
    } catch (err) {
      next(err);
    }
  }

  static async listCouponsByEvent(req, res, next) {
    try {
      const { eventId } = req.params;
      const coupons = await Coupon.find({ eventRef: eventId }).sort({ createdAt: -1 });
      res.status(200).json({
        success: true,
        data: { coupons }
      });
    } catch (err) {
      next(err);
    }
  }
}
