import Organization from '../models/Organization.js';
import Event from '../models/Event.js';
import SponsorProfile from '../models/SponsorProfile.js';
import SponsorPackage from '../models/SponsorPackage.js';
import Sponsorship from '../models/Sponsorship.js';
import { verifyOperatorEventAccess } from './checkInService.js';
import { AppError } from '../utils/AppError.js';

export class SponsorService {
  /**
   * Creates a sponsor company profile within an organization.
   */
  static async createSponsorProfile({
    organizationRef,
    name,
    description,
    logoUrl,
    websiteUrl,
    contactPerson,
    socialLinks,
    operatorUser
  }) {
    if (!operatorUser) throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');

    // Organization authorization
    if (operatorUser.globalRole !== 'platform_admin') {
      const org = await Organization.findById(organizationRef);
      if (!org) throw new AppError('Organization not found.', 404, 'NOT_FOUND');

      const userIdStr = operatorUser._id.toString();
      const isOwner = org.ownerRef.toString() === userIdStr;
      const isAdmin = (org.members || []).some(
        (m) => m.userRef.toString() === userIdStr && ['owner', 'admin'].includes(m.role)
      );

      if (!isOwner && !isAdmin) {
        throw new AppError('Forbidden: You do not have permissions to manage sponsors for this organization.', 403, 'FORBIDDEN');
      }
    }

    const profile = await SponsorProfile.create({
      organizationRef,
      name,
      description,
      logoUrl,
      websiteUrl,
      contactPerson,
      socialLinks
    });

    return profile;
  }

  /**
   * Creates a sponsor package tier for an event.
   */
  static async createSponsorPackage({
    eventRef,
    name,
    tier,
    price,
    currency = 'USD',
    maxSlots,
    benefits = [],
    operatorUser
  }) {
    await verifyOperatorEventAccess(operatorUser, eventRef);

    const sponsorPackage = await SponsorPackage.create({
      eventRef,
      name,
      tier,
      price,
      currency,
      maxSlots,
      benefits
    });

    return sponsorPackage;
  }

  /**
   * Allocates a sponsorship package to a sponsor profile for an event with slot concurrency protection.
   */
  static async allocateSponsorship({
    eventRef,
    sponsorProfileRef,
    packageRef,
    amountPaid = 0,
    paymentStatus = 'pending',
    deliverables = [],
    operatorUser
  }) {
    await verifyOperatorEventAccess(operatorUser, eventRef);

    const event = await Event.findById(eventRef);
    if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

    const profile = await SponsorProfile.findById(sponsorProfileRef);
    if (!profile) throw new AppError('Sponsor profile not found.', 404, 'NOT_FOUND');

    // Atomic slot capacity guard on the package
    const updatedPackage = await SponsorPackage.findOneAndUpdate(
      {
        _id: packageRef,
        eventRef,
        status: 'active',
        $expr: { $lt: ['$allocatedSlots', '$maxSlots'] }
      },
      {
        $inc: { allocatedSlots: 1 }
      },
      { returnDocument: 'after' }
    );

    if (!updatedPackage) {
      throw new AppError('Sponsorship package is either full, inactive, or not found.', 409, 'PACKAGE_SOLD_OUT');
    }

    // Update package status to sold_out if capacity is reached
    if (updatedPackage.allocatedSlots >= updatedPackage.maxSlots) {
      updatedPackage.status = 'sold_out';
      await updatedPackage.save();
    }

    try {
      const sponsorship = await Sponsorship.create({
        eventRef,
        sponsorProfileRef,
        packageRef,
        amountPaid,
        paymentStatus,
        status: 'confirmed',
        deliverables
      });

      return sponsorship;
    } catch (err) {
      // Roll back slot allocation if sponsorship record creation fails with concurrency-safe guard
      await SponsorPackage.findOneAndUpdate(
        { _id: packageRef, allocatedSlots: { $gt: 0 } },
        {
          $inc: { allocatedSlots: -1 },
          $set: { status: 'active' }
        }
      );
      throw err;
    }
  }

  /**
   * Updates deliverable review status (e.g. submitted -> approved / rejected).
   */
  static async updateDeliverableStatus({
    sponsorshipId,
    deliverableId,
    status,
    assetUrl,
    notes,
    operatorUser
  }) {
    if (!operatorUser) throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');

    let sponsorship;
    let targetDeliverableId = deliverableId;

    if (sponsorshipId) {
      sponsorship = await Sponsorship.findById(sponsorshipId);
    } else if (deliverableId) {
      sponsorship = await Sponsorship.findOne({ 'deliverables._id': deliverableId });
    }

    if (!sponsorship) throw new AppError('Sponsorship not found.', 404, 'NOT_FOUND');

    await verifyOperatorEventAccess(operatorUser, sponsorship.eventRef);

    if (!targetDeliverableId && sponsorship.deliverables.length === 1) {
      targetDeliverableId = sponsorship.deliverables[0]._id;
    }

    const deliverable = sponsorship.deliverables.id(targetDeliverableId);
    if (!deliverable) throw new AppError('Deliverable item not found in sponsorship.', 404, 'NOT_FOUND');

    deliverable.status = status;
    if (assetUrl) deliverable.assetUrl = assetUrl;
    if (notes) deliverable.notes = notes;

    if (status === 'submitted') {
      deliverable.submittedAt = new Date();
    } else if (['approved', 'rejected'].includes(status)) {
      deliverable.reviewedAt = new Date();
      deliverable.reviewedByStaffRef = operatorUser._id;
    }

    await sponsorship.save();
    return sponsorship;
  }

  /**
   * Public / Attendee view of event sponsors grouped by tier.
   */
  static async getEventSponsors(eventId) {
    if (!eventId) throw new AppError('Event ID is required.', 400, 'BAD_REQUEST');

    const sponsorships = await Sponsorship.find({
      eventRef: eventId,
      status: 'confirmed'
    })
      .populate('sponsorProfileRef')
      .populate('packageRef')
      .sort({ createdAt: 1 });

    const groupedByTier = {};
    for (const s of sponsorships) {
      const tier = s.packageRef?.tier || 'custom';
      if (!groupedByTier[tier]) {
        groupedByTier[tier] = {
          tier,
          packageName: s.packageRef?.name,
          sponsors: []
        };
      }
      groupedByTier[tier].sponsors.push({
        sponsorshipId: s._id,
        sponsor: s.sponsorProfileRef,
        deliverables: s.deliverables
      });
    }

    return {
      eventId,
      totalSponsors: sponsorships.length,
      tiers: Object.values(groupedByTier)
    };
  }
}
