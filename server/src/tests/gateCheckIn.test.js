import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Event from '../models/Event.js';
import TicketTier from '../models/TicketTier.js';
import Registration from '../models/Registration.js';
import StaffAssignment from '../models/StaffAssignment.js';
import { QRVerificationEngine } from '../services/qrVerificationEngine.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventforge_test_suite?directConnection=true';

describe('Phase 4 — Gate Check-In & Operator RBAC Test Suite', () => {
  let adminUser, adminToken;
  let organizerUser, organizerToken;
  let staffUserA, staffTokenA;
  let staffUserB, staffTokenB;
  let attendeeUser, attendeeToken;
  let org;
  let eventA;
  let eventB;
  let tierA;
  let confirmedReg;
  let badgeTokenPass1;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Registration.deleteMany({});
      await StaffAssignment.deleteMany({});
      await TicketTier.deleteMany({});
      await Event.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await Registration.deleteMany({});
    await StaffAssignment.deleteMany({});
    await TicketTier.deleteMany({});
    await Event.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    // 1. Users
    adminUser = await User.create({
      name: 'Platform Admin',
      email: 'admin@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'platform_admin'
    });
    adminToken = signToken({ id: adminUser._id.toString(), globalRole: 'platform_admin', email: adminUser.email });

    organizerUser = await User.create({
      name: 'Event Organizer',
      email: 'organizer@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    organizerToken = signToken({ id: organizerUser._id.toString(), globalRole: 'user', email: organizerUser.email });

    staffUserA = await User.create({
      name: 'Gate Staff A',
      email: 'staffA@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    staffTokenA = signToken({ id: staffUserA._id.toString(), globalRole: 'user', email: staffUserA.email });

    staffUserB = await User.create({
      name: 'Gate Staff B',
      email: 'staffB@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    staffTokenB = signToken({ id: staffUserB._id.toString(), globalRole: 'user', email: staffUserB.email });

    attendeeUser = await User.create({
      name: 'John Attendee',
      email: 'john@attendee.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    attendeeToken = signToken({ id: attendeeUser._id.toString(), globalRole: 'user', email: attendeeUser.email });

    // 2. Organization & Events
    org = await Organization.create({
      name: 'Forge Global Inc',
      slug: 'forge-global',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    eventA = await Event.create({
      organizationRef: org._id,
      organizerRef: organizerUser._id,
      title: 'Forge Conference 2026',
      slug: 'forge-conf-2026',
      type: 'conference',
      description: 'Annual technology conference',
      totalCapacity: 1000,
      status: 'published',
      startDate: new Date('2026-10-01T09:00:00Z'),
      endDate: new Date('2026-10-03T18:00:00Z')
    });

    eventB = await Event.create({
      organizationRef: org._id,
      organizerRef: organizerUser._id,
      title: 'Alternative Summit 2026',
      slug: 'alt-summit-2026',
      type: 'workshop',
      description: 'Alternative summit meeting',
      totalCapacity: 500,
      status: 'published',
      startDate: new Date('2026-11-01T09:00:00Z'),
      endDate: new Date('2026-11-03T18:00:00Z')
    });

    // 3. TicketTier for Event A
    tierA = await TicketTier.create({
      eventRef: eventA._id,
      name: 'General Admission',
      price: 100,
      totalQuantity: 500,
      salesStart: new Date('2026-01-01T00:00:00Z'),
      salesEnd: new Date('2026-12-31T23:59:59Z'),
      status: 'active'
    });

    // 4. Staff assignment for event A
    await StaffAssignment.create({
      eventRef: eventA._id,
      userRef: staffUserA._id,
      role: 'checkin_staff',
      status: 'active'
    });

    // 5. Staff assignment for event B
    await StaffAssignment.create({
      eventRef: eventB._id,
      userRef: staffUserB._id,
      role: 'checkin_staff',
      status: 'active'
    });

    // 6. Confirmed registration on Event A
    confirmedReg = await Registration.create({
      eventRef: eventA._id,
      userRef: attendeeUser._id,
      ticketTierRef: tierA._id,
      registrationNumber: 'EF-REG-GATE-001',
      quantity: 1,
      totalAmount: 100,
      discountAmount: 0,
      finalAmount: 100,
      status: 'confirmed',
      paymentStatus: 'paid',
      attendeeDetails: {
        firstName: 'John',
        lastName: 'Attendee',
        email: 'john@attendee.com'
      },
      attendeePasses: [
        {
          passNumber: 'EF-REG-GATE-001-1',
          holderName: 'John Attendee',
          holderEmail: 'john@attendee.com',
          checkedIn: false
        }
      ]
    });

    badgeTokenPass1 = QRVerificationEngine.signBadgeToken({
      passNumber: 'EF-REG-GATE-001-1',
      regNum: confirmedReg.registrationNumber,
      eventId: eventA._id,
      userId: attendeeUser._id,
      tierId: tierA._id
    });
  });

  describe('Gate Check-In Functional Flow', () => {
    it('should successfully check in a confirmed pass at main gate (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/checkin/event')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({ token: badgeTokenPass1 });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'checked_in');
      assert.equal(res.body.data.pass.checkedIn, true);

      // Verify DB state
      const dbReg = await Registration.findById(confirmedReg._id);
      assert.equal(dbReg.attendeePasses[0].checkedIn, true);
      assert.ok(dbReg.attendeePasses[0].checkedInAt instanceof Date);
      assert.equal(dbReg.attendeePasses[0].checkedInByStaffRef.toString(), staffUserA._id.toString());
    });

    it('should idempotently handle repeated scans without error (200 OK, already_checked_in)', async () => {
      // First scan
      const first = await request(app)
        .post('/api/v1/checkin/event')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({ token: badgeTokenPass1 });

      assert.equal(first.status, 200);
      assert.equal(first.body.data.status, 'checked_in');

      const initialCheckedInAt = new Date(first.body.data.pass.checkedInAt).getTime();

      // Second scan
      const second = await request(app)
        .post('/api/v1/checkin/event')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({ token: badgeTokenPass1 });

      assert.equal(second.status, 200);
      assert.equal(second.body.success, true);
      assert.equal(second.body.data.status, 'already_checked_in');
      assert.ok(second.body.message.includes('already checked in'));

      // Check DB remains identical
      const dbReg = await Registration.findById(confirmedReg._id);
      assert.equal(dbReg.attendeePasses[0].checkedIn, true);
      assert.equal(new Date(dbReg.attendeePasses[0].checkedInAt).getTime(), initialCheckedInAt);
    });

    it('should safely resolve 20 concurrent scan requests with exactly 1 state change and 19 already_checked_in', async () => {
      const requests = Array.from({ length: 20 }, () =>
        request(app)
          .post('/api/v1/checkin/event')
          .set('Authorization', `Bearer ${staffTokenA}`)
          .send({ token: badgeTokenPass1 })
      );

      const responses = await Promise.all(requests);

      const status200s = responses.filter((r) => r.status === 200);
      assert.equal(status200s.length, 20);

      const checkedInCount = responses.filter((r) => r.body.data?.status === 'checked_in').length;
      const alreadyCheckedInCount = responses.filter((r) => r.body.data?.status === 'already_checked_in').length;

      assert.equal(checkedInCount, 1, 'Exactly one concurrent scan must transition the state to checked_in');
      assert.equal(alreadyCheckedInCount, 19, '19 concurrent scans must return already_checked_in');

      const dbReg = await Registration.findById(confirmedReg._id);
      assert.equal(dbReg.attendeePasses[0].checkedIn, true);
    });
  });

  describe('Invalid Registration States Rejections', () => {
    const invalidStatuses = ['held', 'expired', 'cancelled', 'waitlisted'];

    for (const testStatus of invalidStatuses) {
      it(`should reject gate check-in when registration is in '${testStatus}' status (400 Bad Request)`, async () => {
        const testUser = await User.create({
          name: `Test User ${testStatus}`,
          email: `test-${testStatus}-${Date.now()}@attendee.com`,
          passwordHash: 'Password123!',
          globalRole: 'user'
        });

        const reg = await Registration.create({
          eventRef: eventA._id,
          userRef: testUser._id,
          ticketTierRef: tierA._id,
          registrationNumber: `EF-REG-TEST-${testStatus.toUpperCase()}-${Date.now()}`,
          quantity: 1,
          totalAmount: 100,
          discountAmount: 0,
          finalAmount: 100,
          status: testStatus,
          paymentStatus: testStatus === 'held' ? 'pending' : 'failed',
          attendeeDetails: {
            firstName: 'Test',
            lastName: testStatus,
            email: testUser.email
          },
          attendeePasses: [
            {
              passNumber: `EF-PASS-${testStatus.toUpperCase()}-1`,
              holderName: 'Test Attendee',
              holderEmail: testUser.email,
              checkedIn: false
            }
          ]
        });

        const token = QRVerificationEngine.signBadgeToken({
          passNumber: `EF-PASS-${testStatus.toUpperCase()}-1`,
          regNum: reg.registrationNumber,
          eventId: eventA._id,
          userId: testUser._id,
          tierId: tierA._id
        });

        const res = await request(app)
          .post('/api/v1/checkin/event')
          .set('Authorization', `Bearer ${staffTokenA}`)
          .send({ token });

        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
        assert.ok(res.body.error.message.includes(testStatus));
      });
    }

    it('should reject scanning an Event A badge at an Event B gate (400 WRONG_EVENT)', async () => {
      const res = await request(app)
        .post('/api/v1/checkin/event')
        .set('Authorization', `Bearer ${staffTokenB}`)
        .send({
          token: badgeTokenPass1,
          eventId: eventB._id.toString()
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'WRONG_EVENT');
    });
  });

  describe('Operator RBAC & Cross-Event Boundaries', () => {
    it('should forbid ordinary attendee from performing gate check-in (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/checkin/event')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({ token: badgeTokenPass1 });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should forbid staff of Event B from checking in attendees of Event A (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/checkin/event')
        .set('Authorization', `Bearer ${staffTokenB}`)
        .send({ token: badgeTokenPass1 });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should allow event organizer to perform gate check-in (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/checkin/event')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ token: badgeTokenPass1 });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'checked_in');
    });

    it('should allow platform admin to perform gate check-in (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/checkin/event')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ token: badgeTokenPass1 });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'checked_in');
    });
  });
});
