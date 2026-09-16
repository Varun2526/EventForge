import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Event slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens']
    },
    organizationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization reference is required'],
      index: true
    },
    organizerRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer reference is required'],
      index: true
    },
    type: {
      type: String,
      enum: {
        values: ['conference', 'workshop', 'exhibition', 'webinar', 'corporate_meet'],
        message: '{VALUE} is not a supported event type'
      },
      required: [true, 'Event type is required']
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'ongoing', 'completed', 'cancelled'],
        message: '{VALUE} is not a supported event status'
      },
      default: 'draft',
      index: true
    },
    summary: {
      type: String,
      trim: true,
      maxlength: [300, 'Summary cannot exceed 300 characters'],
      default: ''
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true
    },
    coverImageUrl: {
      type: String,
      default: '',
      trim: true
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true
    },
    venueRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      default: null
    },
    isVirtual: {
      type: Boolean,
      default: false
    },
    virtualMeetingUrl: {
      type: String,
      default: '',
      trim: true
    },
    totalCapacity: {
      type: Number,
      required: [true, 'Total capacity is required'],
      min: [1, 'Total capacity must be at least 1']
    },
    registeredCount: {
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
    settings: {
      requireApproval: {
        type: Boolean,
        default: false
      },
      allowWaitlist: {
        type: Boolean,
        default: true
      },
      enablePublicSchedule: {
        type: Boolean,
        default: true
      },
      registrationDeadline: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

// Compound Indexes for fast filtering
EventSchema.index({ organizationRef: 1, status: 1 });
EventSchema.index({ startDate: 1, endDate: 1 });
EventSchema.index({ tags: 1 });

const Event = mongoose.model('Event', EventSchema);
export default Event;
