import mongoose from 'mongoose';

const PaymentEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: {
        values: ['stripe', 'razorpay', 'mock'],
        message: '{VALUE} is not a supported payment provider'
      },
      required: [true, 'Payment provider is required']
    },
    eventId: {
      type: String,
      required: [true, 'Provider event ID is required'],
      trim: true
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      trim: true
    },
    registrationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      default: null
    },
    status: {
      type: String,
      enum: {
        values: ['received', 'processed', 'failed', 'ignored'],
        message: '{VALUE} is not a valid payment event status'
      },
      default: 'received'
    },
    payload: {
      type: mongoose.Schema.Types.Mixed
    },
    processedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

PaymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

const PaymentEvent = mongoose.model('PaymentEvent', PaymentEventSchema);
export default PaymentEvent;
