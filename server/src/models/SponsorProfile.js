import mongoose from 'mongoose';

const SponsorProfileSchema = new mongoose.Schema(
  {
    organizationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization reference is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Sponsor company name is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    logoUrl: {
      type: String,
      default: '',
      trim: true
    },
    websiteUrl: {
      type: String,
      default: '',
      trim: true
    },
    contactPerson: {
      name: { type: String, default: '', trim: true },
      email: { type: String, default: '', lowercase: true, trim: true },
      phone: { type: String, default: '', trim: true }
    },
    socialLinks: {
      linkedin: { type: String, default: '', trim: true },
      twitter: { type: String, default: '', trim: true },
      github: { type: String, default: '', trim: true }
    }
  },
  {
    timestamps: true
  }
);

SponsorProfileSchema.index({ organizationRef: 1, name: 1 });

const SponsorProfile = mongoose.model('SponsorProfile', SponsorProfileSchema);
export default SponsorProfile;
