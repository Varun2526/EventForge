import mongoose from 'mongoose';

export const SponsorDeliverableSubSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Deliverable title is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    deadline: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'submitted', 'approved', 'rejected'],
        message: '{VALUE} is not a valid deliverable status'
      },
      default: 'pending'
    },
    assetUrl: {
      type: String,
      default: '',
      trim: true
    },
    submittedAt: {
      type: Date,
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewedByStaffRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    notes: {
      type: String,
      default: '',
      trim: true
    }
  },
  { _id: true }
);

const SponsorshipSchema = new mongoose.Schema(
  {
    eventRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true
    },
    sponsorProfileRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SponsorProfile',
      required: [true, 'Sponsor profile reference is required'],
      index: true
    },
    packageRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SponsorPackage',
      required: [true, 'Sponsor package reference is required'],
      index: true
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, 'Amount paid cannot be negative']
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['pending', 'partial', 'paid'],
        message: '{VALUE} is not a valid sponsorship payment status'
      },
      default: 'pending',
      index: true
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'cancelled'],
        message: '{VALUE} is not a valid sponsorship status'
      },
      default: 'confirmed',
      index: true
    },
    deliverables: [SponsorDeliverableSubSchema]
  },
  {
    timestamps: true
  }
);

SponsorshipSchema.index({ eventRef: 1, sponsorProfileRef: 1 }, { unique: true });

const Sponsorship = mongoose.model('Sponsorship', SponsorshipSchema);
export default Sponsorship;
