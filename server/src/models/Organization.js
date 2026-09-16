import mongoose from 'mongoose';

const MemberSubSchema = new mongoose.Schema(
  {
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const OrganizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Organization slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens']
    },
    logoUrl: {
      type: String,
      default: ''
    },
    website: {
      type: String,
      trim: true,
      default: ''
    },
    ownerRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    members: [MemberSubSchema],
    subscription: {
      tier: {
        type: String,
        enum: ['free', 'pro', 'enterprise'],
        default: 'free'
      },
      status: {
        type: String,
        enum: ['active', 'past_due', 'cancelled'],
        default: 'active'
      },
      validUntil: {
        type: Date,
        default: null
      }
    },
    settings: {
      allowPublicRegistration: {
        type: Boolean,
        default: true
      },
      defaultCurrency: {
        type: String,
        default: 'USD'
      }
    }
  },
  {
    timestamps: true
  }
);

OrganizationSchema.index({ 'members.userRef': 1 });
OrganizationSchema.index({ ownerRef: 1 });

const Organization = mongoose.model('Organization', OrganizationSchema);
export default Organization;
