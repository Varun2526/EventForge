import { StaffService } from '../services/staffService.js';

export class StaffController {
  /**
   * Assigns an operational staff role to a user.
   */
  static async assignStaff(req, res, next) {
    try {
      const eventId = req.body.eventId || req.body.eventRef;
      const userId = req.body.userId || req.body.userRef;

      const assignment = await StaffService.assignStaff({
        eventId,
        userId,
        role: req.body.role,
        assignedRoomIds: req.body.assignedRoomIds,
        shiftStart: req.body.shiftStart,
        shiftEnd: req.body.shiftEnd,
        operatorUser: req.user
      });

      res.status(200).json({
        success: true,
        message: 'Staff member assigned successfully.',
        data: { staffAssignment: assignment }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Lists all operational staff assignments for an event.
   */
  static async listStaffByEvent(req, res, next) {
    try {
      const assignments = await StaffService.listStaffByEvent(req.params.eventId, req.user);

      res.status(200).json({
        success: true,
        data: { staffAssignments: assignments }
      });
    } catch (err) {
      next(err);
    }
  }
}
