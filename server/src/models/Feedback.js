import mongoose from 'mongoose';

const FeedbackSchema = new mongoose.Schema(
  {
    eventRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true
    },
    sessionRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
      index: true
    },
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars']
    },
    comment: {
      type: String,
      default: '',
      trim: true
    },
    sentimentScore: {
      type: Number,
      default: 0,
      min: -1.0,
      max: 1.0
    },
    dimensions: {
      contentQuality: {
        type: Number,
        min: 1,
        max: 5,
        default: 5
      },
      speakerClarity: {
        type: Number,
        min: 1,
        max: 5,
        default: 5
      },
      venueEnvironment: {
        type: Number,
        min: 1,
        max: 5,
        default: 5
      }
    }
  },
  {
    timestamps: true
  }
);

FeedbackSchema.index({ eventRef: 1, sessionRef: 1, userRef: 1 }, { unique: true });

const Feedback = mongoose.model('Feedback', FeedbackSchema);
export default Feedback;
