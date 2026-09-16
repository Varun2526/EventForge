import mongoose from 'mongoose';

const StaffAssignmentSchema = new mongoose.Schema(
  {
    eventRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true
    },
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    role: {
      type: String,
      enum: {
        values: ['checkin_staff', 'room_monitor', 'usher', 'support', 'general'],
        message: '{VALUE} is not a valid staff operational role'
      },
      default: 'checkin_staff'
    },
    assignedRoomIds: [
      {
        type: mongoose.Schema.Types.ObjectId
      }
    ],
    shiftStart: {
      type: Date,
      default: null
    },
    shiftEnd: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: '{VALUE} is not a valid staff assignment status'
      },
      default: 'active',
      index: true
    }
  },
  {
    timestamps: true
  }
);

StaffAssignmentSchema.index({ eventRef: 1, userRef: 1 }, { unique: true });

const StaffAssignment = mongoose.model('StaffAssignment', StaffAssignmentSchema);
export default StaffAssignment;
