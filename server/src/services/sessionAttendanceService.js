import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Registration from '../models/Registration.js';
import SessionAttendance from '../models/SessionAttendance.js';
import { QRVerificationEngine } from './qrVerificationEngine.js';
import { verifyOperatorEventAccess } from './checkInService.js';
import { AppError } from '../utils/AppError.js';

export class SessionAttendanceService {
  /**
   * Admits an attendee to a specific session after validating cryptographic badge,
   * gate check-in prerequisite, session-to-event isolation, operator authority,
   * and session room capacity limit.
   *
   * @param {Object} params
   * @param {string} params.token - Raw badge token (EFB1.<payload>.<sig>)
   * @param {string} params.sessionId - Target session ID
   * @param {Object} params.operatorUser - Express req.user
   */
  static async checkInSession({ token, sessionId, operatorUser }) {
    // 1. Cryptographic token verification (pure verification, no DB side-effects)
    const claims = QRVerificationEngine.verifyBadgeToken(token);

    // 2. Validate session existence
    const sessionDoc = await Session.findById(sessionId);
    if (!sessionDoc) {
      throw new AppError('Session not found.', 404, 'NOT_FOUND');
    }

    // 3. Cross-event isolation: session must belong to the same event as the badge
    if (sessionDoc.eventRef.toString() !== claims.eventId.toString()) {
      throw new AppError('Session belongs to a different event than the attendee badge.', 400, 'SESSION_EVENT_MISMATCH');
    }

    // 4. Operator authorization for the session's event
    await verifyOperatorEventAccess(operatorUser, sessionDoc.eventRef);

    // 5. Registration and pass validation
    const reg = await Registration.findOne({
      eventRef: claims.eventId,
      registrationNumber: claims.registrationNumber
    });

    if (!reg) {
      throw new AppError('Registration not found for badge claims.', 404, 'REGISTRATION_NOT_FOUND');
    }

    if (reg.status !== 'confirmed') {
      throw new AppError(
        `Registration is in '${reg.status}' status. Session check-in denied.`,
        400,
        `REGISTRATION_${reg.status.toUpperCase()}`
      );
    }

    const pass = reg.attendeePasses?.find((p) => p.passNumber === claims.passNumber);
    if (!pass) {
      throw new AppError('Attendee pass not found in registration.', 404, 'PASS_NOT_FOUND');
    }

    // 6. Gate check-in prerequisite enforcement
    if (!pass.checkedIn) {
      throw new AppError(
        'Attendee must check in at the main event gate prior to session admission.',
        400,
        'GATE_CHECKIN_REQUIRED'
      );
    }

    // 7. Idempotency check: duplicate scan returns already_attended
    const existingAttendance = await SessionAttendance.findOne({
      sessionRef: sessionDoc._id,
      'attendeePass.passNumber': claims.passNumber
    });

    if (existingAttendance) {
      return {
        status: 'already_attended',
        message: 'Attendee has already been admitted to this session.',
        claims,
        pass,
        attendance: existingAttendance
      };
    }

    // 8. Atomic capacity increment and SessionAttendance creation within a managed transaction
    let result;
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        // Idempotency check inside transaction
        const existingInTx = await SessionAttendance.findOne({
          sessionRef: sessionDoc._id,
          'attendeePass.passNumber': claims.passNumber
        }).session(dbSession);

        if (existingInTx) {
          result = {
            status: 'already_attended',
            message: 'Attendee has already been admitted to this session.',
            claims,
            pass,
            attendance: existingInTx
          };
          return;
        }

        const updatedSession = await Session.findOneAndUpdate(
          {
            _id: sessionDoc._id,
            $expr: { $lt: ['$enrolledCount', '$capacityLimit'] }
          },
          {
            $inc: { enrolledCount: 1 }
          },
          { session: dbSession, returnDocument: 'after' }
        );

        if (!updatedSession) {
          throw new AppError('Session has reached maximum capacity.', 409, 'SESSION_FULL');
        }

        let attendanceDoc;
        try {
          [attendanceDoc] = await SessionAttendance.create(
            [
              {
                sessionRef: sessionDoc._id,
                eventRef: sessionDoc.eventRef,
                registrationRef: reg._id,
                userRef: claims.userId,
                attendeePass: {
                  passNumber: pass.passNumber,
                  holderName: pass.holderName || '',
                  holderEmail: pass.holderEmail || ''
                },
                scannedByStaffRef: operatorUser._id,
                scannedAt: new Date()
              }
            ],
            { session: dbSession }
          );
        } catch (createErr) {
          // Handle race condition on duplicate scan caught by unique index
          if (createErr.code === 11000) {
            const existingAfterConflict = await SessionAttendance.findOne({
              sessionRef: sessionDoc._id,
              'attendeePass.passNumber': claims.passNumber
            }).session(dbSession);

            result = {
              status: 'already_attended',
              message: 'Attendee has already been admitted to this session.',
              claims,
              pass,
              attendance: existingAfterConflict
            };
            return;
          }
          throw createErr;
        }

        result = {
          status: 'admitted',
          message: 'Session attendance confirmed.',
          claims,
          pass,
          attendance: attendanceDoc
        };
      });

      return result;
    } finally {
      await dbSession.endSession();
    }
  }
}
