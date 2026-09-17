import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Event from '../models/Event.js';
import Venue from '../models/Venue.js';
import Session from '../models/Session.js';
import SessionAttendance from '../models/SessionAttendance.js';
import Registration from '../models/Registration.js';
import TicketTier from '../models/TicketTier.js';
import SponsorProfile from '../models/SponsorProfile.js';
import SponsorPackage from '../models/SponsorPackage.js';
import Sponsorship from '../models/Sponsorship.js';
import Feedback from '../models/Feedback.js';
import StaffAssignment from '../models/StaffAssignment.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventforge_test_suite';

describe('Phase 5 — Modular Analytics Engine Test Suite', () => {
  let organizerUser;
  let organizerToken;
  let staffUser;
  let staffToken;
  let outsiderUser;
  let outsiderToken;
  let organization;
  let event;
  let venue;
  let ticketTier;
  let sessionA;
  let sessionB;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Feedback.deleteMany({});
      await Sponsorship.deleteMany({});
      await SponsorPackage.deleteMany({});
      await SponsorProfile.deleteMany({});
      await Registration.deleteMany({});
      await TicketTier.deleteMany({});
      await SessionAttendance.deleteMany({});
      await Session.deleteMany({});
      await Venue.deleteMany({});
      await StaffAssignment.deleteMany({});
      await Event.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await Feedback.deleteMany({});
    await Sponsorship.deleteMany({});
    await SponsorPackage.deleteMany({});
    await SponsorProfile.deleteMany({});
    await Registration.deleteMany({});
    await TicketTier.deleteMany({});
    await SessionAttendance.deleteMany({});
    await Session.deleteMany({});
    await Venue.deleteMany({});
    await StaffAssignment.deleteMany({});
    await Event.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    organizerUser = await User.create({
      name: 'Analytics Director',
      email: 'director@summit.org',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    organizerToken = signToken({
      id: organizerUser._id.toString(),
      globalRole: organizerUser.globalRole,
      email: organizerUser.email
    });

    staffUser = await User.create({
      name: 'Event Staff Member',
      email: 'staff@summit.org',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    staffToken = signToken({
      id: staffUser._id.toString(),
      globalRole: staffUser.globalRole,
      email: staffUser.email
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
      name: 'Global Tech Summit Org',
      slug: 'global-tech-summit-org',
      ownerRef: organizerUser._id
    });

    event = await Event.create({
      title: 'Cloud & AI World 2026',
      slug: 'cloud-ai-world-2026',
      organizationRef: organization._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'published',
      description: 'Analytics test conference',
      startDate: new Date('2026-11-01T09:00:00Z'),
      endDate: new Date('2026-11-01T18:00:00Z'),
      totalCapacity: 500
    });

    // Assign staff member to this event
    await StaffAssignment.create({
      eventRef: event._id,
      userRef: staffUser._id,
      role: 'checkin_staff',
      status: 'active'
    });

    venue = await Venue.create({
      name: 'Metropolitan Hall',
      organizationRef: organization._id,
      address: {
        street: '100 Broadway',
        city: 'New York',
        country: 'USA'
      },
      capacity: 500,
      rooms: [
        { name: 'Room 101', capacity: 100 },
        { name: 'Room 102', capacity: 50 }
      ]
    });

    ticketTier = await TicketTier.create({
      eventRef: event._id,
      name: 'VIP All-Access',
      price: 150,
      currency: 'USD',
      totalQuantity: 200,
      availableQuantity: 188,
      reservedQuantity: 0,
      soldQuantity: 12,
      salesStart: new Date(Date.now() - 86400000),
      salesEnd: new Date(Date.now() + 86400000)
    });

    // Seed confirmed registrations (Order 1: qty 2, $300; Order 2: qty 4, $600) -> totalTicketsSold = 6, grossRevenue = 900
    const attendee1 = await User.create({
      name: 'Attendee One',
      email: 'att1@test.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    const attendee2 = await User.create({
      name: 'Attendee Two',
      email: 'att2@test.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });

    const reg1 = await Registration.create({
      eventRef: event._id,
      userRef: attendee1._id,
      ticketTierRef: ticketTier._id,
      registrationNumber: 'REG-TEST-ANALYTICS-001',
      status: 'confirmed',
      paymentStatus: 'paid',
      quantity: 2,
      baseAmount: 300,
      totalAmount: 300,
      totalAmountPaid: 300,
      discountAmount: 0,
      finalAmount: 300,
      attendeeDetails: {
        firstName: 'Attendee',
        lastName: 'One',
        email: 'att1@test.com'
      },
      attendeePasses: [
        {
          passNumber: 'PASS-1',
          holderName: 'Attendee One',
          holderEmail: 'att1@test.com',
          checkedIn: true,
          checkedInAt: new Date()
        },
        {
          passNumber: 'PASS-2',
          holderName: 'Attendee One Guest',
          holderEmail: 'guest1@test.com',
          checkedIn: false
        }
      ]
    });

    await Registration.create({
      eventRef: event._id,
      userRef: attendee2._id,
      ticketTierRef: ticketTier._id,
      registrationNumber: 'REG-TEST-ANALYTICS-002',
      status: 'confirmed',
      paymentStatus: 'paid',
      quantity: 4,
      baseAmount: 600,
      totalAmount: 600,
      totalAmountPaid: 600,
      discountAmount: 0,
      finalAmount: 600,
      attendeeDetails: {
        firstName: 'Attendee',
        lastName: 'Two',
        email: 'att2@test.com'
      },
      attendeePasses: [
        {
          passNumber: 'PASS-3',
          holderName: 'Attendee Two',
          holderEmail: 'att2@test.com',
          checkedIn: true,
          checkedInAt: new Date()
        },
        {
          passNumber: 'PASS-4',
          holderName: 'Attendee Two Guest A',
          holderEmail: 'guest2a@test.com',
          checkedIn: true,
          checkedInAt: new Date()
        },
        {
          passNumber: 'PASS-5',
          holderName: 'Attendee Two Guest B',
          holderEmail: 'guest2b@test.com',
          checkedIn: false
        },
        {
          passNumber: 'PASS-6',
          holderName: 'Attendee Two Guest C',
          holderEmail: 'guest2c@test.com',
          checkedIn: false
        }
      ]
    });

    // Also seed a cancelled registration (should NOT count toward sold tickets or revenue)
    await Registration.create({
      eventRef: event._id,
      userRef: attendee1._id,
      ticketTierRef: ticketTier._id,
      registrationNumber: 'REG-TEST-ANALYTICS-003',
      status: 'cancelled',
      paymentStatus: 'refunded',
      quantity: 2,
      baseAmount: 300,
      totalAmount: 300,
      discountAmount: 0,
      finalAmount: 300,
      attendeeDetails: {
        firstName: 'Attendee',
        lastName: 'One',
        email: 'att1@test.com'
      },
      attendeePasses: []
    });

    // Seed Sessions
    sessionA = await Session.create({
      eventRef: event._id,
      venueRef: venue._id,
      roomId: venue.rooms[0]._id,
      title: 'Keynote Session',
      roomName: 'Room 101',
      track: 'Main',
      capacityLimit: 100,
      enrolledCount: 75,
      startTime: new Date('2026-11-01T10:00:00Z'),
      endTime: new Date('2026-11-01T11:00:00Z'),
      status: 'scheduled'
    });

    sessionB = await Session.create({
      eventRef: event._id,
      venueRef: venue._id,
      roomId: venue.rooms[1]._id,
      title: 'Deep Dive Workshop',
      roomName: 'Room 102',
      track: 'Workshop',
      capacityLimit: 50,
      enrolledCount: 25,
      startTime: new Date('2026-11-01T14:00:00Z'),
      endTime: new Date('2026-11-01T15:00:00Z'),
      status: 'scheduled'
    });

    // Seed session attendance records
    await SessionAttendance.create({
      eventRef: event._id,
      sessionRef: sessionA._id,
      registrationRef: reg1._id,
      userRef: attendee1._id,
      attendeePass: {
        passNumber: 'PASS-1',
        holderName: 'Attendee One',
        holderEmail: 'att1@test.com'
      },
      scannedByStaffRef: staffUser._id,
      checkInSource: 'kiosk'
    });

    // Seed Sponsor and Sponsorship
    const sponsorProfile = await SponsorProfile.create({
      organizationRef: organization._id,
      name: 'Apex Cloud Systems',
      websiteUrl: 'https://apexcloud.com'
    });

    const sponsorPackage = await SponsorPackage.create({
      eventRef: event._id,
      name: 'Platinum Partner',
      tier: 'platinum',
      price: 5000,
      maxSlots: 2,
      allocatedSlots: 1
    });

    await Sponsorship.create({
      eventRef: event._id,
      sponsorProfileRef: sponsorProfile._id,
      packageRef: sponsorPackage._id,
      amountPaid: 5000,
      paymentStatus: 'paid',
      status: 'confirmed',
      deliverables: [
        { title: 'Banner Ad', status: 'approved' },
        { title: 'Keynote Shoutout', status: 'submitted' },
        { title: 'Booth Booth Signage', status: 'pending' }
      ]
    });

    // Seed Feedback reviews
    await Feedback.create({
      eventRef: event._id,
      sessionRef: sessionA._id,
      userRef: attendee1._id,
      rating: 5,
      sentimentScore: 0.9,
      dimensions: {
        contentQuality: 5,
        speakerClarity: 5,
        venueEnvironment: 4
      },
      comment: 'Outstanding keynote session!'
    });

    await Feedback.create({
      eventRef: event._id,
      sessionRef: sessionB._id,
      userRef: attendee2._id,
      rating: 3,
      sentimentScore: 0.1,
      dimensions: {
        contentQuality: 3,
        speakerClarity: 4,
        venueEnvironment: 3
      },
      comment: 'Average workshop, ran slightly over time.'
    });
  });

  describe('Event Summary KPIs', () => {
    it('should aggregate ticket volume by summing quantity, revenue, and check-in rate accurately (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/${event._id}/summary`)
        .set('Authorization', `Bearer ${organizerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const summary = res.body.data.summary;

      // 2 confirmed orders, 1 cancelled order -> confirmedRegistrations: 2
      assert.equal(summary.confirmedRegistrations, 2);
      assert.equal(summary.cancelledRegistrations, 1);

      // Order 1 (2 tickets) + Order 2 (4 tickets) = 6 totalTicketsSold
      assert.equal(summary.totalTicketsSold, 6);

      // Gross revenue: 300 + 600 = 900
      assert.equal(summary.grossRevenue, 900);

      // Total passes: 2 + 4 = 6. Checked in passes: 1 + 2 = 3. Check-in rate: (3 / 6) * 100 = 50.0%
      assert.equal(summary.totalPasses, 6);
      assert.equal(summary.checkedInPasses, 3);
      assert.equal(summary.checkInRate, 50.0);
    });

    it('should allow assigned event staff to view summary KPIs', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/${event._id}/summary`)
        .set('Authorization', `Bearer ${staffToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    it('should forbid outsider from viewing event summary KPIs (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/${event._id}/summary`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      assert.equal(res.status, 403);
    });
  });

  describe('Session Heatmaps & Room Utilization', () => {
    it('should calculate room utilization % and session popularity ranks (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/${event._id}/heatmaps`)
        .set('Authorization', `Bearer ${organizerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const data = res.body.data;

      assert.equal(data.totalSessions, 2);
      const topSession = data.sessions[0];
      assert.equal(topSession.title, 'Keynote Session');
      assert.equal(topSession.enrolledCount, 75);
      assert.equal(topSession.capacityLimit, 100);
      // Utilization rate = (75 / 100) * 100 = 75.0%
      assert.equal(topSession.utilizationRate, 75);
      assert.equal(topSession.actualAttendanceCount, 1);
    });
  });

  describe('Sponsor Metrics & Deliverable Fulfillment', () => {
    it('should calculate sponsor revenue, deliverable counts, and fulfillment rate % (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/${event._id}/sponsors`)
        .set('Authorization', `Bearer ${organizerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const metrics = res.body.data.sponsorships;

      assert.equal(metrics.totalSponsors, 1);
      assert.equal(metrics.totalRevenue, 5000);
      assert.equal(metrics.totalDeliverables, 3);
      assert.equal(metrics.deliverablesBreakdown.approved, 1);
      assert.equal(metrics.deliverablesBreakdown.submitted, 1);
      assert.equal(metrics.deliverablesBreakdown.pending, 1);
      // Fulfillment rate: 1 approved out of 3 = 33.3%
      assert.equal(metrics.fulfillmentRate, 33.3);
    });
  });

  describe('Feedback & CSAT Analytics', () => {
    it('should aggregate CSAT average, sentiment, and dimensional scores (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/${event._id}/feedback`)
        .set('Authorization', `Bearer ${organizerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const fb = res.body.data.feedback;

      assert.equal(fb.totalReviews, 2);
      // Ratings: 5 and 3 -> Average = 4.0
      assert.equal(fb.averageRating, 4.0);
      // Sentiment: 0.9 and 0.1 -> Average = 0.5
      assert.equal(fb.averageSentiment, 0.5);
      assert.equal(fb.ratingDistribution['5'], 1);
      assert.equal(fb.ratingDistribution['3'], 1);
      assert.equal(fb.ratingDistribution['1'], 0);
      // Dimensions: contentQuality avg (5 + 3)/2 = 4.0
      assert.equal(fb.dimensions.contentQuality, 4.0);
    });
  });

  describe('Strict Read-Only Verification', () => {
    it('should not mutate any database records during analytics calculations', async () => {
      const regCountBefore = await Registration.countDocuments();
      const feedbackCountBefore = await Feedback.countDocuments();
      const sponsorshipCountBefore = await Sponsorship.countDocuments();

      await request(app).get(`/api/v1/analytics/${event._id}/summary`).set('Authorization', `Bearer ${organizerToken}`);
      await request(app).get(`/api/v1/analytics/${event._id}/heatmaps`).set('Authorization', `Bearer ${organizerToken}`);
      await request(app).get(`/api/v1/analytics/${event._id}/sponsors`).set('Authorization', `Bearer ${organizerToken}`);
      await request(app).get(`/api/v1/analytics/${event._id}/feedback`).set('Authorization', `Bearer ${organizerToken}`);

      const regCountAfter = await Registration.countDocuments();
      const feedbackCountAfter = await Feedback.countDocuments();
      const sponsorshipCountAfter = await Sponsorship.countDocuments();

      assert.equal(regCountAfter, regCountBefore);
      assert.equal(feedbackCountAfter, feedbackCountBefore);
      assert.equal(sponsorshipCountAfter, sponsorshipCountBefore);
    });
  });
});
