import Event from '../models/Event.js';
import Organization from '../models/Organization.js';
import Venue from '../models/Venue.js';
import { AppError } from '../utils/AppError.js';

export class EventService {
  /**
   * Slug generator utility.
   */
  static slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Verify organization write permissions.
   */
  static async verifyOrgAccess(orgId, user) {
    if (user.globalRole === 'platform_admin') return true;

    const org = await Organization.findById(orgId);
    if (!org) throw new AppError('Organization not found.', 404, 'NOT_FOUND');

    const userIdStr = user._id.toString();
    if (org.ownerRef.toString() === userIdStr) return true;

    const member = (org.members || []).find((m) => m.userRef.toString() === userIdStr);
    if (member && ['owner', 'admin'].includes(member.role)) return true;

    throw new AppError('Forbidden: You do not have permission to create events in this organization.', 403, 'FORBIDDEN');
  }

  /**
   * Create a new event draft.
   */
  static async createEvent(eventData, user) {
    await this.verifyOrgAccess(eventData.organizationRef, user);

    // Validate venue belongs to the same organization
    if (eventData.venueRef) {
      const venue = await Venue.findById(eventData.venueRef);
      if (!venue) {
        throw new AppError('Venue not found.', 404, 'NOT_FOUND');
      }
      if (venue.organizationRef.toString() !== eventData.organizationRef.toString()) {
        throw new AppError(
          'Cross-organization violation: Venue does not belong to this event’s organization.',
          400,
          'CROSS_ORGANIZATION_RESOURCE'
        );
      }
    }

    // Auto-generate slug if not specified
    let slug = eventData.slug ? this.slugify(eventData.slug) : this.slugify(eventData.title);
    const existingSlug = await Event.findOne({ slug });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36).substring(2, 7)}`;
    }

    const event = await Event.create({
      ...eventData,
      slug,
      organizerRef: user._id,
      status: 'draft'
    });

    return event;
  }

  /**
   * List events with query filters.
   */
  static async listEvents(query = {}, user = null) {
    const filter = {};

    // Public / unauthenticated or explicit public listing: only published / ongoing
    if (!user || query.public === 'true') {
      filter.status = { $in: ['published', 'ongoing'] };
    } else if (query.status) {
      filter.status = query.status;
    }

    if (query.organizationRef) {
      filter.organizationRef = query.organizationRef;
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.tag) {
      filter.tags = query.tag.toLowerCase();
    }

    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { summary: { $regex: query.search, $options: 'i' } }
      ];
    }

    const page = Math.max(1, parseInt(query.page || 1, 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || 20, 10)));
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate('venueRef', 'name address')
        .populate('organizationRef', 'name slug')
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(filter)
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single event by ID or slug.
   */
  static async getEventByIdOrSlug(idOrSlug, user = null) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
    const query = isObjectId ? { _id: idOrSlug } : { slug: idOrSlug };

    const event = await Event.findOne(query)
      .populate('venueRef')
      .populate('organizationRef', 'name slug logoUrl')
      .populate('organizerRef', 'name email');

    if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

    // If event is not published, only organizers or platform admins can view
    if (event.status !== 'published' && event.status !== 'ongoing') {
      if (!user) {
        throw new AppError('Event not found.', 404, 'NOT_FOUND');
      }

      if (user.globalRole !== 'platform_admin' && event.organizerRef._id.toString() !== user._id.toString()) {
        const org = await Organization.findById(event.organizationRef._id);
        const isOrgAdmin = (org?.members || []).some(
          (m) => m.userRef.toString() === user._id.toString() && ['owner', 'admin'].includes(m.role)
        );
        if (!isOrgAdmin && org?.ownerRef.toString() !== user._id.toString()) {
          throw new AppError('Forbidden: You do not have permission to view this unpublished event.', 403, 'FORBIDDEN');
        }
      }
    }

    return event;
  }

  /**
   * Update event configuration.
   */
  static async updateEvent(eventId, updateData, user) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

    // Check venue cross-organization consistency if updated
    if (updateData.venueRef) {
      const venue = await Venue.findById(updateData.venueRef);
      if (!venue) throw new AppError('Venue not found.', 404, 'NOT_FOUND');
      if (venue.organizationRef.toString() !== event.organizationRef.toString()) {
        throw new AppError(
          'Cross-organization violation: Venue does not belong to this event’s organization.',
          400,
          'CROSS_ORGANIZATION_RESOURCE'
        );
      }
    }

    // Check slug uniqueness if updated
    if (updateData.slug && updateData.slug !== event.slug) {
      const cleanSlug = this.slugify(updateData.slug);
      const slugExists = await Event.findOne({ slug: cleanSlug, _id: { $ne: eventId } });
      if (slugExists) {
        throw new AppError('An event with this slug already exists.', 409, 'CONFLICT');
      }
      updateData.slug = cleanSlug;
    }

    const allowedFields = [
      'title',
      'slug',
      'type',
      'status',
      'summary',
      'description',
      'coverImageUrl',
      'startDate',
      'endDate',
      'timezone',
      'venueRef',
      'isVirtual',
      'virtualMeetingUrl',
      'totalCapacity',
      'tags',
      'settings'
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        event[field] = updateData[field];
      }
    });

    await event.save();
    return event;
  }

  /**
   * Publish an event.
   */
  static async publishEvent(eventId) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

    if (new Date(event.startDate) >= new Date(event.endDate)) {
      throw new AppError('Event start date must precede end date.', 400, 'INVALID_DATE_RANGE');
    }

    event.status = 'published';
    await event.save();

    return event;
  }

  /**
   * Delete or cancel an event.
   */
  static async cancelEvent(eventId) {
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

    event.status = 'cancelled';
    await event.save();

    return { success: true, message: 'Event marked as cancelled.' };
  }
}
