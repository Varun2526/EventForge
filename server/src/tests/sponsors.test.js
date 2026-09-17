import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Event from '../models/Event.js';
import SponsorProfile from '../models/SponsorProfile.js';
import SponsorPackage from '../models/SponsorPackage.js';
import Sponsorship from '../models/Sponsorship.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventforge_test_suite';

describe('Phase 5 — Sponsor Management Test Suite', () => {
  let organizerUser;
  let organizerToken;
  let outsiderUser;
  let outsiderToken;
  let organization;
  let event;
  let sponsorProfile;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Sponsorship.deleteMany({});
      await SponsorPackage.deleteMany({});
      await SponsorProfile.deleteMany({});
      await Event.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await Sponsorship.deleteMany({});
    await SponsorPackage.deleteMany({});
    await SponsorProfile.deleteMany({});
    await Event.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    organizerUser = await User.create({
      name: 'Sponsor Lead',
      email: 'lead@summit.org',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    organizerToken = signToken({
      id: organizerUser._id.toString(),
      globalRole: organizerUser.globalRole,
      email: organizerUser.email
    });

    outsiderUser = await User.create({
      name: 'Outsider User',
      email: 'outsider@other.org',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    outsiderToken = signToken({
      id: outsiderUser._id.toString(),
      globalRole: outsiderUser.globalRole,
      email: outsiderUser.email
    });

    organization = await Organization.create({
      name: 'Tech Ventures Organization',
      slug: 'tech-ventures-org',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    event = await Event.create({
      title: 'Global Tech Summit 2026',
      slug: 'global-tech-summit-2026',
      organizationRef: organization._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'published',
      description: 'Annual sponsorship partner event.',
      startDate: new Date('2026-12-01T09:00:00Z'),
      endDate: new Date('2026-12-02T18:00:00Z'),
      totalCapacity: 800
    });

    sponsorProfile = await SponsorProfile.create({
      organizationRef: organization._id,
      name: 'Alpha Software Corp',
      websiteUrl: 'https://alphasoftware.io',
      description: 'Enterprise developer tools'
    });
  });

  describe('Sponsor Profile Management', () => {
    it('should allow organization owner to create a sponsor profile (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/sponsors/profiles')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          organizationRef: organization._id.toString(),
          name: 'Beta Cloud Networks',
          websiteUrl: 'https://betacloud.com',
          description: 'Global content delivery'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'Beta Cloud Networks');
    });

    it('should forbid user outside organization from creating a sponsor profile (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/sponsors/profiles')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          organizationRef: organization._id.toString(),
          name: 'Illegal Profile'
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });
  });

  describe('Sponsor Package Tier Management', () => {
    it('should allow organizer to create a sponsor package (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/sponsors/packages')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: event._id.toString(),
          name: 'Headline Partner',
          tier: 'headline',
          price: 10000,
          currency: 'USD',
          maxSlots: 1,
          benefits: ['Keynote stage branding', 'Exhibition booth', '10 VIP passes']
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.maxSlots, 1);
      assert.equal(res.body.data.allocatedSlots, 0);
    });

    it('should reject duplicate package name for the same event (409 Conflict)', async () => {
      await SponsorPackage.create({
        eventRef: event._id,
        name: 'Gold Sponsor',
        tier: 'gold',
        price: 3000,
        maxSlots: 5
      });

      const res = await request(app)
        .post('/api/v1/sponsors/packages')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: event._id.toString(),
          name: 'Gold Sponsor',
          tier: 'gold',
          price: 3500,
          maxSlots: 3
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
    });
  });

  describe('Sponsorship Allocation & Slot Concurrency', () => {
    it('should allocate sponsorship and increment allocatedSlots (201 Created)', async () => {
      const pkg = await SponsorPackage.create({
        eventRef: event._id,
        name: 'Silver Sponsor',
        tier: 'silver',
        price: 2000,
        maxSlots: 2,
        allocatedSlots: 0
      });

      const res = await request(app)
        .post('/api/v1/sponsors/partnerships')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: event._id.toString(),
          sponsorProfileRef: sponsorProfile._id.toString(),
          packageRef: pkg._id.toString(),
          amountPaid: 2000,
          paymentStatus: 'paid',
          deliverables: [
            { title: 'Company Logo', formatRequired: 'SVG vector' }
          ]
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);

      const updatedPkg = await SponsorPackage.findById(pkg._id);
      assert.equal(updatedPkg.allocatedSlots, 1);
    });

    it('should reject allocation when package slots are exhausted (409 PACKAGE_SOLD_OUT)', async () => {
      const pkg = await SponsorPackage.create({
        eventRef: event._id,
        name: 'Exclusive Title Sponsor',
        tier: 'headline',
        price: 25000,
        maxSlots: 1,
        allocatedSlots: 1,
        status: 'sold_out'
      });

      const res = await request(app)
        .post('/api/v1/sponsors/partnerships')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: event._id.toString(),
          sponsorProfileRef: sponsorProfile._id.toString(),
          packageRef: pkg._id.toString(),
          amountPaid: 25000
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'PACKAGE_SOLD_OUT');
    });

    it('should atomically guard package slots under concurrent allocation attempts', async () => {
      const limitedPkg = await SponsorPackage.create({
        eventRef: event._id,
        name: 'Limited Community Sponsor',
        tier: 'community',
        price: 500,
        maxSlots: 2,
        allocatedSlots: 0
      });

      // Create 5 distinct sponsor profiles
      const profiles = [];
      for (let i = 0; i < 5; i++) {
        const p = await SponsorProfile.create({
          organizationRef: organization._id,
          name: `Concurrent Sponsor ${i}`
        });
        profiles.push(p);
      }

      // Concurrently attempt to allocate all 5
      const attempts = profiles.map((p) =>
        request(app)
          .post('/api/v1/sponsors/partnerships')
          .set('Authorization', `Bearer ${organizerToken}`)
          .send({
            eventRef: event._id.toString(),
            sponsorProfileRef: p._id.toString(),
            packageRef: limitedPkg._id.toString(),
            amountPaid: 500
          })
      );

      const results = await Promise.all(attempts);
      const successes = results.filter((r) => r.status === 201);
      const failures = results.filter((r) => r.status === 409);

      assert.equal(successes.length, 2, 'Exactly 2 allocations should succeed');
      assert.equal(failures.length, 3, 'Remaining 3 allocations must be rejected with 409');

      const finalPkg = await SponsorPackage.findById(limitedPkg._id);
      assert.equal(finalPkg.allocatedSlots, 2);
      assert.equal(finalPkg.status, 'sold_out');
    });
  });

  describe('Deliverable Submission & Review Workflow', () => {
    it('should allow submitting and approving marketing deliverables (200 OK)', async () => {
      const pkg = await SponsorPackage.create({
        eventRef: event._id,
        name: 'Bronze Sponsor',
        tier: 'bronze',
        price: 1000,
        maxSlots: 5
      });

      const allocRes = await request(app)
        .post('/api/v1/sponsors/partnerships')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: event._id.toString(),
          sponsorProfileRef: sponsorProfile._id.toString(),
          packageRef: pkg._id.toString(),
          deliverables: [{ title: 'Logo Asset', status: 'pending' }]
        });

      const sponsorshipId = allocRes.body.data._id;
      const deliverableId = allocRes.body.data.deliverables[0]._id;

      // 1. Submit asset
      const submitRes = await request(app)
        .put(`/api/v1/sponsors/deliverables/${deliverableId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          sponsorshipId,
          status: 'submitted',
          assetUrl: 'https://cdn.alphasoftware.io/logo.svg'
        });

      assert.equal(submitRes.status, 200);
      const submittedItem = submitRes.body.data.deliverables.find((d) => d._id === deliverableId);
      assert.equal(submittedItem.status, 'submitted');
      assert.equal(submittedItem.assetUrl, 'https://cdn.alphasoftware.io/logo.svg');
      assert.ok(submittedItem.submittedAt);

      // 2. Approve deliverable
      const approveRes = await request(app)
        .put(`/api/v1/sponsors/deliverables/${deliverableId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          sponsorshipId,
          status: 'approved',
          notes: 'Asset verified and passes branding guidelines.'
        });

      assert.equal(approveRes.status, 200);
      const approvedItem = approveRes.body.data.deliverables.find((d) => d._id === deliverableId);
      assert.equal(approvedItem.status, 'approved');
      assert.ok(approvedItem.reviewedAt);
      assert.equal(approvedItem.reviewedByStaffRef, organizerUser._id.toString());
    });
  });

  describe('Public Event Sponsor Listing', () => {
    it('should return confirmed event sponsors grouped by tier without auth (200 OK)', async () => {
      const pkg = await SponsorPackage.create({
        eventRef: event._id,
        name: 'Gold Tier',
        tier: 'gold',
        price: 5000,
        maxSlots: 3,
        allocatedSlots: 1
      });

      await Sponsorship.create({
        eventRef: event._id,
        sponsorProfileRef: sponsorProfile._id,
        packageRef: pkg._id,
        status: 'confirmed'
      });

      const res = await request(app).get(`/api/v1/sponsors/event/${event._id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.totalSponsors, 1);
      assert.equal(res.body.data.tiers.length, 1);
      assert.equal(res.body.data.tiers[0].tier, 'gold');
    });
  });
});
