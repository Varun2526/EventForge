import Session from '../models/Session.js';
import { AppError } from '../utils/AppError.js';

/**
 * Pure domain service for schedule interval collision detection.
 * Enforces:
 *   Overlap condition: (StartA < EndB) && (EndA > StartB)
 *   Status filter: non-cancelled sessions only
 *   Scope: Scoped strictly to eventRef (cross-event isolation)
 *   Self-exclusion: Excludes excludeSessionId on updates
 */
export class ConflictDetectionEngine {
  /**
   * Check if a room is occupied during an overlapping interval in this event.
   */
  static async checkRoomConflict({ eventRef, roomId, startTime, endTime, excludeSessionId = null }) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      throw new AppError('Session start time must precede end time.', 400, 'INVALID_TIME_RANGE');
    }

    const query = {
      eventRef,
      roomId,
      startTime: { $lt: end },
      endTime: { $gt: start },
      status: { $ne: 'cancelled' }
    };

    if (excludeSessionId) {
      query._id = { $ne: excludeSessionId };
    }

    const conflictingSession = await Session.findOne(query).lean();

    if (conflictingSession) {
      return {
        hasConflict: true,
        type: 'ROOM_CONFLICT',
        message: `Room conflict: Session "${conflictingSession.title}" is already scheduled in room "${conflictingSession.roomName}" between ${conflictingSession.startTime.toISOString()} and ${conflictingSession.endTime.toISOString()}.`,
        conflictingSession
      };
    }

    return { hasConflict: false };
  }

  /**
   * Check if any of the assigned speakers are double-booked during an overlapping interval in this event.
   */
  static async checkSpeakerConflict({ eventRef, speakerRefs = [], startTime, endTime, excludeSessionId = null }) {
    if (!speakerRefs || speakerRefs.length === 0) {
      return { hasConflict: false };
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      throw new AppError('Session start time must precede end time.', 400, 'INVALID_TIME_RANGE');
    }

    const query = {
      eventRef,
      speakerRefs: { $in: speakerRefs },
      startTime: { $lt: end },
      endTime: { $gt: start },
      status: { $ne: 'cancelled' }
    };

    if (excludeSessionId) {
      query._id = { $ne: excludeSessionId };
    }

    const conflictingSession = await Session.findOne(query).populate('speakerRefs', 'fullName').lean();

    if (conflictingSession) {
      const conflictingSpeakerNames = (conflictingSession.speakerRefs || [])
        .filter((s) => speakerRefs.some((id) => id.toString() === s._id.toString()))
        .map((s) => s.fullName)
        .join(', ');

      return {
        hasConflict: true,
        type: 'SPEAKER_CONFLICT',
        message: `Speaker conflict: Speaker(s) [${conflictingSpeakerNames}] already assigned to "${conflictingSession.title}" during this time window.`,
        conflictingSession
      };
    }

    return { hasConflict: false };
  }

  /**
   * Orchestrates both room and speaker collision checks.
   * Throws AppError with 409 if a conflict is detected.
   */
  static async validateSessionSchedule({
    eventRef,
    roomId,
    startTime,
    endTime,
    speakerRefs = [],
    excludeSessionId = null,
    throwOnError = true
  }) {
    // 1. Room collision check
    const roomCheck = await this.checkRoomConflict({
      eventRef,
      roomId,
      startTime,
      endTime,
      excludeSessionId
    });

    if (roomCheck.hasConflict) {
      if (throwOnError) {
        throw new AppError(roomCheck.message, 409, 'SESSION_SCHEDULE_CONFLICT', {
          conflictType: 'ROOM_CONFLICT',
          conflictingSessionId: roomCheck.conflictingSession._id,
          conflictingSessionTitle: roomCheck.conflictingSession.title
        });
      }
      return roomCheck;
    }

    // 2. Speaker collision check
    const speakerCheck = await this.checkSpeakerConflict({
      eventRef,
      speakerRefs,
      startTime,
      endTime,
      excludeSessionId
    });

    if (speakerCheck.hasConflict) {
      if (throwOnError) {
        throw new AppError(speakerCheck.message, 409, 'SESSION_SCHEDULE_CONFLICT', {
          conflictType: 'SPEAKER_CONFLICT',
          conflictingSessionId: speakerCheck.conflictingSession._id,
          conflictingSessionTitle: speakerCheck.conflictingSession.title
        });
      }
      return speakerCheck;
    }

    return { hasConflict: false };
  }
}
