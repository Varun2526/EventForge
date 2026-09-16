import SpeakerProfile from '../models/SpeakerProfile.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { AppError } from '../utils/AppError.js';

export class SpeakerService {
  /**
   * Create speaker profile for an event.
   */
  static async createSpeaker(speakerData) {
    const event = await Event.findById(speakerData.eventRef);
    if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

    if (speakerData.userRef) {
      const user = await User.findById(speakerData.userRef);
      if (!user) throw new AppError('Linked user account not found.', 404, 'NOT_FOUND');

      const existingProfile = await SpeakerProfile.findOne({
        eventRef: speakerData.eventRef,
        userRef: speakerData.userRef
      });
      if (existingProfile) {
        throw new AppError('A speaker profile for this user already exists in this event.', 409, 'CONFLICT');
      }
    }

    const speaker = await SpeakerProfile.create(speakerData);
    return speaker;
  }

  /**
   * List speakers for an event.
   */
  static async listSpeakersByEvent(eventId) {
    return SpeakerProfile.find({ eventRef: eventId })
      .populate('userRef', 'name email avatarUrl')
      .sort({ fullName: 1 });
  }

  /**
   * Get speaker profile by ID.
   */
  static async getSpeakerById(speakerId) {
    const speaker = await SpeakerProfile.findById(speakerId)
      .populate('userRef', 'name email avatarUrl')
      .populate('eventRef', 'title slug startDate endDate');
    if (!speaker) throw new AppError('Speaker profile not found.', 404, 'NOT_FOUND');
    return speaker;
  }

  /**
   * Update speaker profile.
   */
  static async updateSpeaker(speakerId, updateData, user) {
    const speaker = await SpeakerProfile.findById(speakerId);
    if (!speaker) throw new AppError('Speaker profile not found.', 404, 'NOT_FOUND');

    // Authorization: speaker self-update OR event organizer / platform_admin
    const isSelf = speaker.userRef && speaker.userRef.toString() === user._id.toString();
    const isGlobalAdmin = user.globalRole === 'platform_admin';

    if (!isSelf && !isGlobalAdmin) {
      const event = await Event.findById(speaker.eventRef);
      const isOrganizer = event && event.organizerRef.toString() === user._id.toString();
      if (!isOrganizer) {
        throw new AppError('Forbidden: You do not have permission to modify this speaker profile.', 403, 'FORBIDDEN');
      }
    }

    const allowedFields = ['fullName', 'headline', 'bio', 'avatarUrl', 'company', 'position', 'socials', 'topics', 'status'];
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        speaker[field] = updateData[field];
      }
    });

    await speaker.save();
    return speaker;
  }

  /**
   * Delete speaker profile if not in scheduled sessions.
   */
  static async deleteSpeaker(speakerId) {
    const speaker = await SpeakerProfile.findById(speakerId);
    if (!speaker) throw new AppError('Speaker profile not found.', 404, 'NOT_FOUND');

    const assignedSessionsCount = await Session.countDocuments({
      speakerRefs: speakerId,
      status: { $ne: 'cancelled' }
    });

    if (assignedSessionsCount > 0) {
      throw new AppError('Cannot delete speaker: Speaker is assigned to scheduled sessions.', 400, 'SPEAKER_IN_USE');
    }

    await SpeakerProfile.findByIdAndDelete(speakerId);
    return { success: true, message: 'Speaker profile deleted successfully.' };
  }
}
