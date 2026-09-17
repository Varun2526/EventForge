import { SponsorService } from '../services/sponsorService.js';

export class SponsorController {
  /**
   * Creates a sponsor brand profile under an organization.
   */
  static async createProfile(req, res, next) {
    try {
      const profile = await SponsorService.createSponsorProfile({
        ...req.body,
        operatorUser: req.user
      });

      res.status(201).json({
        success: true,
        message: 'Sponsor profile created successfully.',
        data: profile
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Creates a tier package for an event.
   */
  static async createPackage(req, res, next) {
    try {
      const pkg = await SponsorService.createSponsorPackage({
        ...req.body,
        operatorUser: req.user
      });

      res.status(201).json({
        success: true,
        message: 'Sponsor package created successfully.',
        data: pkg
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Allocates a package to a sponsor with slot concurrency protection.
   */
  static async allocateSponsorship(req, res, next) {
    try {
      const sponsorship = await SponsorService.allocateSponsorship({
        ...req.body,
        operatorUser: req.user
      });

      res.status(201).json({
        success: true,
        message: 'Sponsorship allocated successfully.',
        data: sponsorship
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Updates deliverable review status (submission, approval, rejection).
   */
  static async updateDeliverable(req, res, next) {
    try {
      const sponsorship = await SponsorService.updateDeliverableStatus({
        sponsorshipId: req.body.sponsorshipId || (req.params.deliverableId ? req.params.id : undefined),
        deliverableId: req.body.deliverableId || req.params.deliverableId || req.params.id,
        status: req.body.status,
        assetUrl: req.body.assetUrl,
        notes: req.body.notes,
        operatorUser: req.user
      });

      res.status(200).json({
        success: true,
        message: 'Deliverable updated successfully.',
        data: sponsorship
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public/organizer view of event sponsors grouped by tier.
   */
  static async getEventSponsors(req, res, next) {
    try {
      const sponsors = await SponsorService.getEventSponsors(req.params.eventId);
      res.status(200).json({
        success: true,
        data: sponsors
      });
    } catch (err) {
      next(err);
    }
  }
}
