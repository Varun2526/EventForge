import Event from '../models/Event.js';
import User from '../models/User.js';
import StaffAssignment from '../models/StaffAssignment.js';
import Organization from '../models/Organization.js';
import { AppError } from '../utils/AppError.js';

export class StaffService {
  /**
   * Authorizes an operator to manage staff on an event (must be platform_admin or event_organizer).
   */
  static async requireOrganizerOrAdmin(operatorUser, eventId) {
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

    // Direct event organizer
    if (event.organizerRef.toString() === operatorIdStr) {
      return true;
    }

    // Organization owner or admin
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

    throw new AppError('Forbidden: Only event organizers or platform admins can manage staff.', 403, 'FORBIDDEN');
  }

  /**
   * Assigns an operational role to a user for an event.
   */
  static async assignStaff({ eventId, userId, role, assignedRoomIds, shiftStart, shiftEnd, operatorUser }) {
    await this.requireOrganizerOrAdmin(operatorUser, eventId);

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      throw new AppError('Target user not found.', 404, 'NOT_FOUND');
    }

    const assignment = await StaffAssignment.findOneAndUpdate(
      { eventRef: eventId, userRef: userId },
      {
        $set: {
          role: role || 'checkin_staff',
          assignedRoomIds: assignedRoomIds || [],
          shiftStart: shiftStart ? new Date(shiftStart) : null,
          shiftEnd: shiftEnd ? new Date(shiftEnd) : null,
          status: 'active'
        }
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    return assignment;
  }

  /**
   * Lists all staff assignments for an event.
   */
  static async listStaffByEvent(eventId, operatorUser) {
    await this.requireOrganizerOrAdmin(operatorUser, eventId);

    const assignments = await StaffAssignment.find({ eventRef: eventId })
      .populate('userRef', 'name email globalRole')
      .sort({ createdAt: -1 });

    return assignments;
  }
}
