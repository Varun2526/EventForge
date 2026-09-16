import { AppError } from '../utils/AppError.js';
import Event from '../models/Event.js';
import Organization from '../models/Organization.js';
import SpeakerProfile from '../models/SpeakerProfile.js';
import StaffAssignment from '../models/StaffAssignment.js';

export const requireGlobalRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required prior to role verification.', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.globalRole)) {
      return next(
        new AppError(
          `Forbidden: Role '${req.user.globalRole}' does not have permission to access this platform resource.`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};

export const requireOrganizationRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required prior to organization authorization.', 401, 'UNAUTHORIZED'));
      }

      if (req.user.globalRole === 'platform_admin') {
        req.orgRole = 'owner';
        return next();
      }

      const orgId = req.params.organizationId || req.body?.organizationRef || req.query?.organizationId || req.params.id;
      if (!orgId) {
        return next(new AppError('Organization context is required.', 400, 'BAD_REQUEST'));
      }

      const org = await Organization.findById(orgId);
      if (!org) {
        return next(new AppError('Organization not found.', 404, 'NOT_FOUND'));
      }

      const userIdStr = req.user._id.toString();

      // Check owner
      if (org.ownerRef.toString() === userIdStr) {
        req.organization = org;
        req.orgRole = 'owner';
        return next();
      }

      // Check members
      const memberRecord = (org.members || []).find((m) => m.userRef.toString() === userIdStr);
      if (memberRecord && allowedRoles.includes(memberRecord.role)) {
        req.organization = org;
        req.orgRole = memberRecord.role;
        return next();
      }

      return next(new AppError('Forbidden: You do not have permissions for this organization.', 403, 'FORBIDDEN'));
    } catch (err) {
      next(err);
    }
  };
};

export const requireEventRole = (...allowedEventRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required prior to event authorization.', 401, 'UNAUTHORIZED'));
      }

      // Platform admin bypass
      if (req.user.globalRole === 'platform_admin') {
        req.eventRole = 'platform_admin';
        return next();
      }

      const eventId = req.params.eventId || req.body?.eventId || req.body?.eventRef || req.query?.eventId || req.params.id;
      if (!eventId) {
        return next(new AppError('Event context is required for authorization.', 400, 'BAD_REQUEST'));
      }

      const event = await Event.findById(eventId);
      if (!event) {
        return next(new AppError('Event not found.', 404, 'NOT_FOUND'));
      }

      req.event = event;
      const userIdStr = req.user._id.toString();

      // 1. Check if user is the direct event organizer
      if (event.organizerRef.toString() === userIdStr) {
        req.eventRole = 'event_organizer';
        if (allowedEventRoles.includes('event_organizer')) {
          return next();
        }
      }

      // 2. Check if user is an owner/admin of the parent organization
      const org = await Organization.findById(event.organizationRef);
      if (org) {
        if (org.ownerRef.toString() === userIdStr) {
          req.eventRole = 'event_organizer';
          if (allowedEventRoles.includes('event_organizer')) {
            return next();
          }
        }

        const isOrgAdmin = (org.members || []).some(
          (m) => m.userRef.toString() === userIdStr && ['owner', 'admin'].includes(m.role)
        );
        if (isOrgAdmin) {
          req.eventRole = 'event_organizer';
          if (allowedEventRoles.includes('event_organizer')) {
            return next();
          }
        }
      }

      // 3. Check if user is an assigned confirmed speaker
      if (allowedEventRoles.includes('speaker')) {
        const speakerProfile = await SpeakerProfile.findOne({
          eventRef: event._id,
          userRef: req.user._id,
          status: 'confirmed'
        });
        if (speakerProfile) {
          req.eventRole = 'speaker';
          req.speakerProfile = speakerProfile;
          return next();
        }
      }

      // 4. Check if user is an active event staff member
      if (allowedEventRoles.includes('event_staff')) {
        const staffAssignment = await StaffAssignment.findOne({
          eventRef: event._id,
          userRef: req.user._id,
          status: 'active'
        });
        if (staffAssignment) {
          req.eventRole = 'event_staff';
          req.staffAssignment = staffAssignment;
          return next();
        }
      }

      return next(new AppError('Forbidden: You do not have the required event-scoped privileges.', 403, 'FORBIDDEN'));
    } catch (err) {
      next(err);
    }
  };
};
