import mongoose from 'mongoose';

const SessionAttendanceSchema = new mongoose.Schema(
  {
    sessionRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'Session reference is required'],
      index: true
    },
    eventRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true
    },
    registrationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: [true, 'Registration reference is required'],
      index: true
    },
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    attendeePass: {
      passNumber: {
        type: String,
        required: [true, 'Attendee pass number is required']
      },
      holderName: {
        type: String,
        default: ''
      },
      holderEmail: {
        type: String,
        default: ''
      }
    },
    scannedByStaffRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff scanner reference is required']
    },
    scannedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

SessionAttendanceSchema.index({ sessionRef: 1, 'attendeePass.passNumber': 1 }, { unique: true });
SessionAttendanceSchema.index({ eventRef: 1, scannedAt: 1 });

const SessionAttendance = mongoose.model('SessionAttendance', SessionAttendanceSchema);
export default SessionAttendance;
