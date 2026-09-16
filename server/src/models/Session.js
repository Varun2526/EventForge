import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema(
  {
    eventRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Session title is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    type: {
      type: String,
      enum: {
        values: ['keynote', 'panel', 'breakout', 'workshop', 'networking', 'fireside_chat'],
        message: '{VALUE} is not a valid session type'
      },
      default: 'breakout'
    },
    track: {
      type: String,
      trim: true,
      default: 'General'
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Room reference is required']
    },
    roomName: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true
    },
    startTime: {
      type: Date,
      required: [true, 'Session start time is required'],
      index: true
    },
    endTime: {
      type: Date,
      required: [true, 'Session end time is required'],
      index: true
    },
    speakerRefs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SpeakerProfile'
      }
    ],
    capacityLimit: {
      type: Number,
      required: [true, 'Capacity limit is required'],
      min: [1, 'Capacity limit must be at least 1']
    },
    enrolledCount: {
      type: Number,
      default: 0,
      min: 0
    },
    tags: [
      {
        type: String,
        lowercase: true,
        trim: true
      }
    ],
    isLiveStreamed: {
      type: Boolean,
      default: false
    },
    streamUrl: {
      type: String,
      default: '',
      trim: true
    },
    slidesUrl: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['scheduled', 'in_progress', 'completed', 'cancelled'],
        message: '{VALUE} is not a valid session status'
      },
      default: 'scheduled'
    }
  },
  {
    timestamps: true
  }
);

// Critical compound indexes for collision detection and schedule querying
SessionSchema.index({ eventRef: 1, roomId: 1, startTime: 1, endTime: 1 });
SessionSchema.index({ speakerRefs: 1, startTime: 1, endTime: 1 });

const Session = mongoose.model('Session', SessionSchema);
export default Session;
