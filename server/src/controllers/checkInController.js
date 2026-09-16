import { CheckInService } from '../services/checkInService.js';
import { SessionAttendanceService } from '../services/sessionAttendanceService.js';

export class CheckInController {
  /**
   * Main gate attendee check-in scanner.
   */
  static async checkInEventGate(req, res, next) {
    try {
      const result = await CheckInService.checkInGate({
        token: req.body.token,
        operatorUser: req.user,
        targetEventId: req.body.eventId
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Session door attendee check-in scanner.
   */
  static async checkInSessionDoor(req, res, next) {
    try {
      const result = await SessionAttendanceService.checkInSession({
        token: req.body.token,
        sessionId: req.body.sessionId,
        operatorUser: req.user
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
