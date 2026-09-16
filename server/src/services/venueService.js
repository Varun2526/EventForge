import Venue from '../models/Venue.js';
import Organization from '../models/Organization.js';
import Event from '../models/Event.js';
import Session from '../models/Session.js';
import { AppError } from '../utils/AppError.js';

export class VenueService {
  /**
   * Check if user is authorized to manage an organization's venues.
   */
  static async verifyOrgAccess(orgId, user) {
    if (user.globalRole === 'platform_admin') return true;

    const org = await Organization.findById(orgId);
    if (!org) throw new AppError('Organization not found.', 404, 'NOT_FOUND');

    const userIdStr = user._id.toString();
    if (org.ownerRef.toString() === userIdStr) return true;

    const member = (org.members || []).find((m) => m.userRef.toString() === userIdStr);
    if (member && ['owner', 'admin'].includes(member.role)) return true;

    throw new AppError('Forbidden: You do not have permission to manage this organization’s venues.', 403, 'FORBIDDEN');
  }

  /**
   * Create a new venue.
   */
  static async createVenue(venueData, user) {
    await this.verifyOrgAccess(venueData.organizationRef, user);

    const venue = await Venue.create(venueData);
    return venue;
  }

  /**
   * List venues with optional organization filtering.
   */
  static async listVenues(query = {}, user) {
    const filter = {};

    if (query.organizationRef) {
      filter.organizationRef = query.organizationRef;
    } else if (user.globalRole !== 'platform_admin') {
      // Find organizations user belongs to
      const userOrgs = await Organization.find({
        $or: [{ ownerRef: user._id }, { 'members.userRef': user._id }]
      }).select('_id');
      filter.organizationRef = { $in: userOrgs.map((o) => o._id) };
    }

    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    return Venue.find(filter).sort({ name: 1 });
  }

  /**
   * Get venue details by ID.
   */
  static async getVenueById(venueId) {
    const venue = await Venue.findById(venueId).populate('organizationRef', 'name slug');
    if (!venue) throw new AppError('Venue not found.', 404, 'NOT_FOUND');
    return venue;
  }

  /**
   * Update venue details.
   */
  static async updateVenue(venueId, updateData, user) {
    const venue = await Venue.findById(venueId);
    if (!venue) throw new AppError('Venue not found.', 404, 'NOT_FOUND');

    await this.verifyOrgAccess(venue.organizationRef, user);

    const allowedFields = ['name', 'address', 'capacity', 'contactPerson'];
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        venue[field] = updateData[field];
      }
    });

    await venue.save();
    return venue;
  }

  /**
   * Delete venue if no active events reference it.
   */
  static async deleteVenue(venueId, user) {
    const venue = await Venue.findById(venueId);
    if (!venue) throw new AppError('Venue not found.', 404, 'NOT_FOUND');

    await this.verifyOrgAccess(venue.organizationRef, user);

    const activeEventsCount = await Event.countDocuments({
      venueRef: venueId,
      status: { $in: ['published', 'ongoing'] }
    });

    if (activeEventsCount > 0) {
      throw new AppError(
        'Cannot delete venue: Active published events are currently assigned to this venue.',
        400,
        'VENUE_IN_USE'
      );
    }

    await Venue.findByIdAndDelete(venueId);
    return { success: true, message: 'Venue deleted successfully.' };
  }

  /**
   * Add a room to a venue.
   */
  static async addRoom(venueId, roomData, user) {
    const venue = await Venue.findById(venueId);
    if (!venue) throw new AppError('Venue not found.', 404, 'NOT_FOUND');

    await this.verifyOrgAccess(venue.organizationRef, user);

    const nameLower = roomData.name.toLowerCase();
    const duplicate = venue.rooms.some((r) => r.name.toLowerCase() === nameLower);
    if (duplicate) {
      throw new AppError(`A room named "${roomData.name}" already exists in this venue.`, 409, 'CONFLICT');
    }

    venue.rooms.push(roomData);
    await venue.save();

    return venue.rooms[venue.rooms.length - 1];
  }

  /**
   * Get all rooms for a venue.
   */
  static async listRooms(venueId) {
    const venue = await Venue.findById(venueId).select('name rooms');
    if (!venue) throw new AppError('Venue not found.', 404, 'NOT_FOUND');
    return venue.rooms;
  }

  /**
   * Get a specific room by ID.
   */
  static async getRoomById(venueId, roomId) {
    const venue = await Venue.findById(venueId);
    if (!venue) throw new AppError('Venue not found.', 404, 'NOT_FOUND');

    const room = venue.rooms.id(roomId);
    if (!room) throw new AppError('Room not found in this venue.', 404, 'NOT_FOUND');

    return room;
  }

  /**
   * Update a room in a venue.
   */
  static async updateRoom(venueId, roomId, roomData, user) {
    const venue = await Venue.findById(venueId);
    if (!venue) throw new AppError('Venue not found.', 404, 'NOT_FOUND');

    await this.verifyOrgAccess(venue.organizationRef, user);

    const room = venue.rooms.id(roomId);
    if (!room) throw new AppError('Room not found in this venue.', 404, 'NOT_FOUND');

    if (roomData.name && roomData.name.toLowerCase() !== room.name.toLowerCase()) {
      const nameLower = roomData.name.toLowerCase();
      const duplicate = venue.rooms.some((r) => r._id.toString() !== roomId && r.name.toLowerCase() === nameLower);
      if (duplicate) {
        throw new AppError(`A room named "${roomData.name}" already exists in this venue.`, 409, 'CONFLICT');
      }
      room.name = roomData.name;
    }

    if (roomData.floor !== undefined) room.floor = roomData.floor;
    if (roomData.capacity !== undefined) room.capacity = roomData.capacity;
    if (roomData.avEquipment !== undefined) room.avEquipment = roomData.avEquipment;
    if (roomData.notes !== undefined) room.notes = roomData.notes;

    await venue.save();
    return room;
  }

  /**
   * Delete a room from a venue if no active sessions are scheduled.
   */
  static async deleteRoom(venueId, roomId, user) {
    const venue = await Venue.findById(venueId);
    if (!venue) throw new AppError('Venue not found.', 404, 'NOT_FOUND');

    await this.verifyOrgAccess(venue.organizationRef, user);

    const room = venue.rooms.id(roomId);
    if (!room) throw new AppError('Room not found in this venue.', 404, 'NOT_FOUND');

    const scheduledSessions = await Session.countDocuments({
      roomId,
      status: { $ne: 'cancelled' }
    });

    if (scheduledSessions > 0) {
      throw new AppError('Cannot delete room: Scheduled sessions are currently assigned to this room.', 400, 'ROOM_IN_USE');
    }

    venue.rooms.pull(roomId);
    await venue.save();

    return { success: true, message: 'Room removed successfully.' };
  }
}
