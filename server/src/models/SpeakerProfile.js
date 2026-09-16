import mongoose from 'mongoose';

const SpeakerProfileSchema = new mongoose.Schema(
  {
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    eventRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true
    },
    fullName: {
      type: String,
      required: [true, 'Speaker full name is required'],
      trim: true
    },
    headline: {
      type: String,
      trim: true,
      default: ''
    },
    bio: {
      type: String,
      required: [true, 'Speaker biography is required'],
      trim: true
    },
    avatarUrl: {
      type: String,
      default: '',
      trim: true
    },
    company: {
      type: String,
      trim: true,
      default: ''
    },
    position: {
      type: String,
      trim: true,
      default: ''
    },
    socials: {
      linkedin: { type: String, default: '', trim: true },
      twitter: { type: String, default: '', trim: true },
      github: { type: String, default: '', trim: true },
      website: { type: String, default: '', trim: true }
    },
    topics: [
      {
        type: String,
        trim: true,
        lowercase: true
      }
    ],
    status: {
      type: String,
      enum: {
        values: ['invited', 'confirmed', 'declined'],
        message: '{VALUE} is not a valid speaker status'
      },
      default: 'confirmed'
    }
  },
  {
    timestamps: true
  }
);

SpeakerProfileSchema.index({ eventRef: 1, userRef: 1 });

const SpeakerProfile = mongoose.model('SpeakerProfile', SpeakerProfileSchema);
export default SpeakerProfile;
