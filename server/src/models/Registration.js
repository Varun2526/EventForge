import mongoose from 'mongoose';

export const AttendeePassSubSchema = new mongoose.Schema(
  {
    passNumber: {
      type: String,
      required: [true, 'Pass number is required']
    },
    holderName: {
      type: String,
      required: [true, 'Holder name is required'],
      trim: true
    },
    holderEmail: {
      type: String,
      required: [true, 'Holder email is required'],
      lowercase: true,
      trim: true
    },
    qrCodePayload: {
      type: String,
      default: null
    },
    checkedIn: {
      type: Boolean,
      default: false,
      index: true
    },
    checkedInAt: {
      type: Date,
      default: null
    },
    checkedInByStaffRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { _id: true }
);

const RegistrationSchema = new mongoose.Schema(
  {
    eventRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true
    },
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    ticketTierRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TicketTier',
      required: [true, 'Ticket tier reference is required'],
      index: true
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1
    },
    status: {
      type: String,
      enum: {
        values: ['held', 'confirmed', 'cancelled', 'expired', 'waitlisted', 'pending_approval', 'rejected'],
        message: '{VALUE} is not a valid registration status'
      },
      default: 'held',
      index: true
    },
    holdType: {
      type: String,
      enum: {
        values: ['checkout', 'waitlist_claim', null],
        message: '{VALUE} is not a valid hold type'
      },
      default: 'checkout'
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['unpaid', 'pending', 'paid', 'failed', 'refunded', 'free'],
        message: '{VALUE} is not a valid payment status'
      },
      default: 'unpaid'
    },
    holdExpiresAt: {
      type: Date,
      index: true,
      default: null
    },
    paymentIntentId: {
      type: String,
      default: null
    },
    totalAmountPaid: {
      type: Number,
      default: 0,
      min: [0, 'Total amount paid cannot be negative']
    },
    couponRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null
    },
    waitlistPosition: {
      type: Number,
      default: null
    },
    waitlistJoinedAt: {
      type: Date,
      default: null
    },
    attendeeDetails: {
      firstName: { type: String, required: [true, 'First name is required'], trim: true },
      lastName: { type: String, required: [true, 'Last name is required'], trim: true },
      email: { type: String, required: [true, 'Email is required'], lowercase: true, trim: true },
      phone: { type: String, default: '', trim: true },
      company: { type: String, default: '', trim: true },
      designation: { type: String, default: '', trim: true },
      dietaryRequirements: { type: String, default: 'None', trim: true },
      tShirtSize: {
        type: String,
        enum: ['XS', 'S', 'M', 'L', 'XL', '2XL', 'None'],
        default: 'None'
      }
    },
    attendeePasses: [AttendeePassSubSchema]
  },
  {
    timestamps: true
  }
);

// CRITICAL: Partial Unique Index 1 (Active Registration Guard)
// A user can hold at most ONE active registration per event.
RegistrationSchema.index(
  { eventRef: 1, userRef: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['held', 'confirmed', 'pending_approval'] }
    }
  }
);

// CRITICAL: Partial Unique Index 2 (Active Waitlist Guard)
// A user cannot occupy multiple waitlist spots for the same tier.
RegistrationSchema.index(
  { eventRef: 1, userRef: 1, ticketTierRef: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'waitlisted' }
  }
);

RegistrationSchema.index({ ticketTierRef: 1, waitlistPosition: 1 });

const Registration = mongoose.model('Registration', RegistrationSchema);
export default Registration;
