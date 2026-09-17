import mongoose from 'mongoose';

const SponsorPackageSchema = new mongoose.Schema(
  {
    eventRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Sponsor package name is required'],
      trim: true
    },
    tier: {
      type: String,
      enum: {
        values: ['headline', 'platinum', 'gold', 'silver', 'bronze', 'in_kind', 'community', 'custom'],
        message: '{VALUE} is not a valid sponsor package tier'
      },
      default: 'silver',
      index: true
    },
    price: {
      type: Number,
      required: [true, 'Package price is required'],
      min: [0, 'Price cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true
    },
    maxSlots: {
      type: Number,
      required: [true, 'Maximum sponsorship slots is required'],
      min: [1, 'Must offer at least 1 sponsorship slot']
    },
    allocatedSlots: {
      type: Number,
      default: 0,
      min: [0, 'Allocated slots cannot be negative']
    },
    benefits: [
      {
        type: String,
        trim: true
      }
    ],
    status: {
      type: String,
      enum: {
        values: ['active', 'sold_out', 'archived'],
        message: '{VALUE} is not a valid package status'
      },
      default: 'active',
      index: true
    }
  },
  {
    timestamps: true
  }
);

SponsorPackageSchema.index({ eventRef: 1, name: 1 }, { unique: true });

const SponsorPackage = mongoose.model('SponsorPackage', SponsorPackageSchema);
export default SponsorPackage;
