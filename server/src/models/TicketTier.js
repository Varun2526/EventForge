import mongoose from 'mongoose';

const TicketTierSchema = new mongoose.Schema(
  {
    eventRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Tier name is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true
    },
    totalQuantity: {
      type: Number,
      required: [true, 'Total quantity is required'],
      min: [1, 'Total quantity must be at least 1']
    },
    soldQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Sold quantity cannot be negative']
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Reserved quantity cannot be negative']
    },
    salesStart: {
      type: Date,
      required: [true, 'Sales start date is required']
    },
    salesEnd: {
      type: Date,
      required: [true, 'Sales end date is required']
    },
    maxPerOrder: {
      type: Number,
      default: 5,
      min: [1, 'maxPerOrder must be at least 1']
    },
    perks: [
      {
        type: String,
        trim: true
      }
    ],
    accessLevel: {
      type: String,
      enum: {
        values: ['standard', 'all_access', 'vip', 'speaker', 'sponsor'],
        message: '{VALUE} is not a valid access level'
      },
      default: 'standard'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Derived virtual for available seats
TicketTierSchema.virtual('availableQuantity').get(function () {
  return Math.max(0, this.totalQuantity - (this.soldQuantity + this.reservedQuantity));
});

TicketTierSchema.index({ eventRef: 1, isActive: 1 });

const TicketTier = mongoose.model('TicketTier', TicketTierSchema);
export default TicketTier;
