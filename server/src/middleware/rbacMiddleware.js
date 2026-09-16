import { AppError } from '../utils/AppError.js';

/**
 * Authorization guard for global platform-level roles.
 * Must be preceded by authenticate middleware.
 *
 * @param {...string} allowedRoles - Global roles permitted (e.g. 'platform_admin', 'user')
 */
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

/**
 * Event-scoped role authorization guard foundation.
 * Evaluates dynamic contextual permissions per event (Phase 2+).
 * Platform admins bypass event checks automatically.
 *
 * @param {...string} allowedEventRoles - Event-scoped roles permitted ('event_organizer', 'event_staff', 'speaker', 'attendee', 'sponsor')
 */
export const requireEventRole = (...allowedEventRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required prior to event authorization.', 401, 'UNAUTHORIZED'));
    }

    // Platform admins have universal access across all event domains
    if (req.user.globalRole === 'platform_admin') {
      req.eventRole = 'platform_admin';
      return next();
    }

    // Contextual resolution will be wired in Phase 2 when Event & Staff models exist
    // For now, provide standard hook
    const eventId = req.params.eventId || req.body.eventRef || req.params.id;
    if (!eventId) {
      return next(new AppError('Event context required for authorization.', 400, 'BAD_REQUEST'));
    }

    // Default rejection until event ownership/staff resolution is hooked in Phase 2
    return next(new AppError('Forbidden: Insufficient event-scoped privileges.', 403, 'FORBIDDEN'));
  };
};
