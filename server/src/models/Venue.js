import mongoose from 'mongoose';

export const RoomSubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true
    },
    floor: {
      type: String,
      default: 'Ground',
      trim: true
    },
    capacity: {
      type: Number,
      required: [true, 'Room capacity is required'],
      min: [1, 'Room capacity must be at least 1']
    },
    avEquipment: [
      {
        type: String,
        trim: true
      }
    ],
    notes: {
      type: String,
      default: '',
      trim: true
    }
  },
  { _id: true }
);

const VenueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Venue name is required'],
      trim: true
    },
    organizationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization reference is required'],
      index: true
    },
    address: {
      street: { type: String, required: [true, 'Street address is required'], trim: true },
      city: { type: String, required: [true, 'City is required'], trim: true },
      state: { type: String, trim: true, default: '' },
      postalCode: { type: String, trim: true, default: '' },
      country: { type: String, required: [true, 'Country is required'], trim: true },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
      }
    },
    capacity: {
      type: Number,
      required: [true, 'Venue capacity is required'],
      min: [1, 'Venue capacity must be at least 1']
    },
    contactPerson: {
      name: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, lowercase: true, default: '' },
      phone: { type: String, trim: true, default: '' }
    },
    rooms: [RoomSubSchema]
  },
  {
    timestamps: true
  }
);

VenueSchema.index({ organizationRef: 1, name: 1 });

const Venue = mongoose.model('Venue', VenueSchema);
export default Venue;
