import mongoose from 'mongoose';

const CouponSchema = new mongoose.Schema(
  {
    eventRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true
    },
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      uppercase: true,
      trim: true
    },
    discountType: {
      type: String,
      enum: {
        values: ['percentage', 'fixed_amount'],
        message: '{VALUE} is not a valid discount type'
      },
      required: [true, 'Discount type is required']
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [1, 'Discount value must be at least 1']
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount cannot be negative']
    },
    maxUses: {
      type: Number,
      required: [true, 'Maximum uses limit is required'],
      min: [1, 'Maximum uses must be at least 1']
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'Used count cannot be negative']
    },
    reservedUses: {
      type: Number,
      default: 0,
      min: [0, 'Reserved uses cannot be negative']
    },
    validFrom: {
      type: Date,
      required: [true, 'Valid from date is required']
    },
    validUntil: {
      type: Date,
      required: [true, 'Valid until date is required']
    },
    applicableTierRefs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TicketTier'
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

CouponSchema.index({ eventRef: 1, code: 1 }, { unique: true });

const Coupon = mongoose.model('Coupon', CouponSchema);
export default Coupon;
