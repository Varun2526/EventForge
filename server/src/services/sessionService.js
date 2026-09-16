import Session from '../models/Session.js';
import Event from '../models/Event.js';
import Venue from '../models/Venue.js';
import SpeakerProfile from '../models/SpeakerProfile.js';
import { ConflictDetectionEngine } from './conflictEngine.js';
import { AppError } from '../utils/AppError.js';

export class SessionService {
  /**
   * Validate that room belongs to the event's venue and retrieve room details.
   */
  static async validateRoomInEventVenue(event, roomId) {
    if (!event.venueRef) {
      throw new AppError(
        'Cannot schedule session: The event does not have an assigned venue.',
        400,
        'VENUE_NOT_ASSIGNED'
      );
    }

    const venue = await Venue.findById(event.venueRef);
    if (!venue) throw new AppError('Assigned venue not found.', 404, 'NOT_FOUND');

    const room = venue.rooms.id(roomId);
    if (!room) {
      throw new AppError(
        'Room validation failure: The specified room does not belong to the event’s assigned venue.',
        400,
        'ROOM_NOT_IN_VENUE'
      );
    }

    return room;
  }

  /**
   * Validate that all assigned speakers belong to the event.
   */
  static async validateSpeakersInEvent(eventId, speakerRefs = []) {
    if (!speakerRefs || speakerRefs.length === 0) return;

    const validSpeakers = await SpeakerProfile.find({
      _id: { $in: speakerRefs },
      eventRef: eventId
    }).select('_id');

    if (validSpeakers.length !== speakerRefs.length) {
      throw new AppError(
        'Cross-event speaker violation: One or more speakers do not belong to this event.',
        400,
        'INVALID_SPEAKER_ASSIGNMENT'
      );
    }
  }

  /**
   * Create a new session with conflict verification.
   */
  static async createSession(sessionData) {
    const event = await Event.findById(sessionData.eventRef);
    if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

    // 1. Validate room belongs to venue
    const room = await this.validateRoomInEventVenue(event, sessionData.roomId);
    sessionData.roomName = room.name;

    // 2. Validate speakers belong to event
    await this.validateSpeakersInEvent(sessionData.eventRef, sessionData.speakerRefs);

    // 3. Run Conflict Detection Engine (Room & Speaker collisions)
    await ConflictDetectionEngine.validateSessionSchedule({
      eventRef: sessionData.eventRef,
      roomId: sessionData.roomId,
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      speakerRefs: sessionData.speakerRefs
    });

    const session = await Session.create(sessionData);
    return session;
  }

  /**
   * List sessions for an event schedule grid.
   */
  static async listSessionsByEvent(eventId, query = {}) {
    const filter = { eventRef: eventId };

    if (query.track) {
      filter.track = query.track;
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.roomId) {
      filter.roomId = query.roomId;
    }

    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = { $ne: 'cancelled' };
    }

    return Session.find(filter)
      .populate('speakerRefs', 'fullName headline avatarUrl company')
      .sort({ startTime: 1 });
  }

  /**
   * Get session details by ID.
   */
  static async getSessionById(sessionId) {
    const session = await Session.findById(sessionId)
      .populate('eventRef', 'title slug startDate endDate timezone')
      .populate('speakerRefs', 'fullName headline bio avatarUrl company position socials');
    if (!session) throw new AppError('Session not found.', 404, 'NOT_FOUND');
    return session;
  }

  /**
   * Update session schedule/room/details with self-exclusion conflict check.
   */
  static async updateSession(sessionId, updateData) {
    const session = await Session.findById(sessionId);
    if (!session) throw new AppError('Session not found.', 404, 'NOT_FOUND');

    const event = await Event.findById(session.eventRef);
    if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

    const targetRoomId = updateData.roomId || session.roomId;
    const targetStartTime = updateData.startTime || session.startTime;
    const targetEndTime = updateData.endTime || session.endTime;
    const targetSpeakerRefs = updateData.speakerRefs !== undefined ? updateData.speakerRefs : session.speakerRefs;

    // Validate room if modified
    if (updateData.roomId && updateData.roomId.toString() !== session.roomId.toString()) {
      const room = await this.validateRoomInEventVenue(event, updateData.roomId);
      session.roomName = room.name;
    }

    // Validate speakers if modified
    if (updateData.speakerRefs) {
      await this.validateSpeakersInEvent(session.eventRef, updateData.speakerRefs);
    }

    // Run Conflict Detection Engine with SELF-EXCLUSION
    const isTimeOrPlaceOrSpeakerChanged =
      updateData.roomId || updateData.startTime || updateData.endTime || updateData.speakerRefs;

    if (isTimeOrPlaceOrSpeakerChanged && updateData.status !== 'cancelled') {
      await ConflictDetectionEngine.validateSessionSchedule({
        eventRef: session.eventRef,
        roomId: targetRoomId,
        startTime: targetStartTime,
        endTime: targetEndTime,
        speakerRefs: targetSpeakerRefs,
        excludeSessionId: sessionId
      });
    }

    const allowedFields = [
      'title',
      'description',
      'type',
      'track',
      'roomId',
      'startTime',
      'endTime',
      'speakerRefs',
      'capacityLimit',
      'tags',
      'isLiveStreamed',
      'streamUrl',
      'slidesUrl',
      'status'
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        session[field] = updateData[field];
      }
    });

    await session.save();
    return session;
  }

  /**
   * Cancel or delete a session.
   */
  static async cancelSession(sessionId) {
    const session = await Session.findById(sessionId);
    if (!session) throw new AppError('Session not found.', 404, 'NOT_FOUND');

    session.status = 'cancelled';
    await session.save();

    return { success: true, message: 'Session cancelled successfully.' };
  }
}
