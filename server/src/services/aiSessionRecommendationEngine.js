import User from '../models/User.js';
import Session from '../models/Session.js';
import SessionAttendance from '../models/SessionAttendance.js';
import { AppError } from '../utils/AppError.js';

export class AISessionRecommendationEngine {
  /**
   * Computes Jaccard Similarity coefficient between two sets of terms:
   * J(A, B) = |A ∩ B| / |A ∪ B|
   */
  static calculateJaccardSimilarity(setA, setB) {
    if (setA.size === 0 && setB.size === 0) return 0;
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Checks if two session intervals overlap in time:
   * Overlap condition: (StartA < EndB) && (EndA > StartB)
   */
  static isTimeOverlapping(sessionA, sessionB) {
    const startA = new Date(sessionA.startTime).getTime();
    const endA = new Date(sessionA.endTime).getTime();
    const startB = new Date(sessionB.startTime).getTime();
    const endB = new Date(sessionB.endTime).getTime();
    return startA < endB && endA > startB;
  }

  /**
   * Generates personalized, conflict-aware session recommendations for an attendee.
   *
   * @param {Object} params
   * @param {string} params.eventId - Event context
   * @param {string} params.userId - Attendee user context
   */
  static async getRecommendations({ eventId, userId }) {
    if (!eventId || !userId) {
      throw new AppError('Event ID and User ID are required for recommendations.', 400, 'BAD_REQUEST');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User profile not found.', 404, 'NOT_FOUND');
    }

    // 1. Retrieve past attended sessions for this user at this event
    const attendedRecords = await SessionAttendance.find({
      userRef: userId,
      eventRef: eventId
    }).populate('sessionRef');

    const attendedSessionIds = new Set(
      attendedRecords.map((a) => a.sessionRef?._id?.toString() || a.sessionRef?.toString()).filter(Boolean)
    );

    const attendedTags = new Set(
      attendedRecords.flatMap((a) => (a.sessionRef?.tags || []).map((t) => t.toLowerCase().trim()))
    );

    // 2. Build attendee preference feature set
    const rawInterests = user.interests || user.profile?.interests || [];
    const userInterestSet = new Set(
      rawInterests.map((i) => i.toLowerCase().trim()).filter(Boolean)
    );
    const combinedAttendeeFeatures = new Set([...userInterestSet, ...attendedTags]);

    // 3. Retrieve all active scheduled sessions for target event (strictly event-isolated)
    const sessions = await Session.find({
      eventRef: eventId,
      status: { $in: ['scheduled', 'in_progress'] }
    })
      .populate('speakerRefs', 'name organization bio')
      .sort({ startTime: 1 });

    if (!sessions || sessions.length === 0) {
      return {
        eventId,
        userId,
        totalAvailableSessions: 0,
        recommendedItinerary: [],
        conflictingAlternatives: [],
        alreadyAttendedCount: attendedSessionIds.size
      };
    }

    // 4. Filter out sessions already attended
    const eligibleSessions = sessions.filter((s) => !attendedSessionIds.has(s._id.toString()));

    // 5. Score candidates using Jaccard similarity and generate factual explanations
    const scoredCandidates = eligibleSessions.map((session) => {
      const sessionTags = (session.tags || []).map((t) => t.toLowerCase().trim());
      const sessionFeatures = new Set([
        ...sessionTags,
        session.track?.toLowerCase()?.trim(),
        session.type?.toLowerCase()?.trim()
      ].filter(Boolean));

      const matchingInterests = [...userInterestSet].filter((i) => sessionFeatures.has(i));
      const matchingAttended = [...attendedTags].filter((t) => sessionFeatures.has(t));

      const jaccardScore = this.calculateJaccardSimilarity(combinedAttendeeFeatures, sessionFeatures);

      // Construct verified factual explanation
      let explanation;
      if (matchingInterests.length > 0) {
        explanation = `Matches your registered interests in: ${matchingInterests.join(', ')}.`;
      } else if (matchingAttended.length > 0) {
        explanation = `Related to topics from previous sessions you attended: ${matchingAttended.join(', ')}.`;
      } else {
        explanation = `Featured session in the ${session.track} track.`;
      }

      const isFull = session.enrolledCount >= session.capacityLimit;

      return {
        session,
        sessionId: session._id.toString(),
        score: Number(jaccardScore.toFixed(4)),
        similarityScore: Number(jaccardScore.toFixed(4)),
        matchPercentage: Math.round(jaccardScore * 100),
        matchingTags: [...new Set([...matchingInterests, ...matchingAttended])],
        isFull,
        explanation
      };
    });

    // 6. Rank candidates by similarity score descending, then startTime ascending
    scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.session.startTime) - new Date(b.session.startTime);
    });

    // 7. Conflict-Aware Schedule Pruning
    // Separate candidates into a conflict-free recommended itinerary and conflicting alternatives
    const recommendedItinerary = [];
    const conflictingAlternatives = [];

    for (const candidate of scoredCandidates) {
      const conflictingSession = recommendedItinerary.find((accepted) =>
        this.isTimeOverlapping(accepted.session, candidate.session)
      );

      if (!conflictingSession) {
        recommendedItinerary.push(candidate);
      } else {
        const windowStr = `${conflictingSession.session.startTime.toISOString()} - ${conflictingSession.session.endTime.toISOString()}`;
        conflictingAlternatives.push({
          ...candidate,
          conflictsWith: {
            sessionId: conflictingSession.session._id.toString(),
            title: conflictingSession.session.title,
            timeWindow: windowStr,
            conflictingWindow: windowStr
          }
        });
      }
    }

    return {
      eventId,
      userId,
      totalAvailableSessions: sessions.length,
      recommendedItinerary,
      conflictingAlternatives,
      alreadyAttendedCount: attendedSessionIds.size
    };
  }
}
