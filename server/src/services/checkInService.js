import Event from '../models/Event.js';
import Organization from '../models/Organization.js';
import Registration from '../models/Registration.js';
import StaffAssignment from '../models/StaffAssignment.js';
import { QRVerificationEngine } from './qrVerificationEngine.js';
import { AppError } from '../utils/AppError.js';

/**
 * Validates that an operator user has operational authority (platform_admin, organizer, or active staff)
 * on a specified event.
 */
export async function verifyOperatorEventAccess(operatorUser, eventId) {
  if (!operatorUser) {
    throw new AppError('Operator authentication required.', 401, 'UNAUTHORIZED');
  }

  if (operatorUser.globalRole === 'platform_admin') {
    return true;
  }

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found.', 404, 'NOT_FOUND');
  }

  const operatorIdStr = operatorUser._id.toString();

  // 1. Direct event organizer
  if (event.organizerRef.toString() === operatorIdStr) {
    return true;
  }

  // 2. Organization owner or admin
  const org = await Organization.findById(event.organizationRef);
  if (org) {
    if (org.ownerRef.toString() === operatorIdStr) {
      return true;
    }
    const isOrgAdmin = (org.members || []).some(
      (m) => m.userRef.toString() === operatorIdStr && ['owner', 'admin'].includes(m.role)
    );
    if (isOrgAdmin) {
      return true;
    }
  }

  // 3. Active staff assignment on this event
  const staff = await StaffAssignment.findOne({
    eventRef: eventId,
    userRef: operatorUser._id,
    status: 'active'
  });
  if (staff) {
    return true;
  }

  throw new AppError('Forbidden: You do not have permissions to perform check-ins for this event.', 403, 'FORBIDDEN');
}

export class CheckInService {
  /**
   * Performs idempotent event gate check-in using a cryptographic badge token.
   *
   * @param {Object} params
   * @param {string} params.token - Raw badge token (EFB1.<payload>.<sig>)
   * @param {Object} params.operatorUser - Express req.user representing scanner
   * @param {string} [params.targetEventId] - Optional event context at the scanner device
   */
  static async checkInGate({ token, operatorUser, targetEventId }) {
    // 1. Cryptographic token verification (pure verification, no DB side-effects)
    const claims = QRVerificationEngine.verifyBadgeToken(token);

    // 2. Event context match verification
    if (targetEventId && targetEventId.toString() !== claims.eventId.toString()) {
      throw new AppError('Badge is not valid for this event.', 400, 'WRONG_EVENT');
    }

    // 3. Authorize operator on the event
    await verifyOperatorEventAccess(operatorUser, claims.eventId);

    // 4. Atomic conditional update on the specific attendee pass
    const registration = await Registration.findOneAndUpdate(
      {
        eventRef: claims.eventId,
        registrationNumber: claims.registrationNumber,
        status: 'confirmed',
        'attendeePasses.passNumber': claims.passNumber,
        'attendeePasses.checkedIn': false
      },
      {
        $set: {
          'attendeePasses.$.checkedIn': true,
          'attendeePasses.$.checkedInAt': new Date(),
          'attendeePasses.$.checkedInByStaffRef': operatorUser._id
        }
      },
      { returnDocument: 'after' }
    );

    if (registration) {
      const pass = registration.attendeePasses.find((p) => p.passNumber === claims.passNumber);
      return {
        status: 'checked_in',
        message: 'Gate check-in successful.',
        claims,
        pass,
        registration
      };
    }

    // 5. If no document was updated, inspect existing record to determine exact reason
    const existing = await Registration.findOne({
      eventRef: claims.eventId,
      registrationNumber: claims.registrationNumber
    });

    if (!existing) {
      throw new AppError('Registration not found for badge claims.', 404, 'REGISTRATION_NOT_FOUND');
    }

    if (existing.status !== 'confirmed') {
      throw new AppError(
        `Registration is in '${existing.status}' status. Check-in denied.`,
        400,
        `REGISTRATION_${existing.status.toUpperCase()}`
      );
    }

    const pass = existing.attendeePasses?.find((p) => p.passNumber === claims.passNumber);
    if (!pass) {
      throw new AppError('Attendee pass not found in registration.', 404, 'PASS_NOT_FOUND');
    }

    if (pass.checkedIn) {
      return {
        status: 'already_checked_in',
        message: `Badge was already checked in at ${pass.checkedInAt ? new Date(pass.checkedInAt).toISOString() : 'earlier'}.`,
        claims,
        pass,
        registration: existing
      };
    }

    throw new AppError('Gate check-in could not be processed.', 400, 'CHECKIN_FAILED');
  }
}
