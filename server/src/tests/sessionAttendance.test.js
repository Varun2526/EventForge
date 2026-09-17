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
import TicketTier from '../models/TicketTier.js';
import Registration from '../models/Registration.js';
import StaffAssignment from '../models/StaffAssignment.js';
import SessionAttendance from '../models/SessionAttendance.js';
import { QRVerificationEngine } from '../services/qrVerificationEngine.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventforge_test_suite?directConnection=true';

describe('Phase 4 — Session Attendance & Capacity Enforcement Test Suite', () => {
  let organizerUser, organizerToken;
  let staffUserA, staffTokenA;
  let staffUserB, staffTokenB;
  let attendeeUser1, attendeeToken1;
  let attendeeUser2;
  let org;
  let eventA, eventB;
  let venueA;
  let room1Id;
  let sessionA1, sessionA2, sessionB1;
  let tierA;
  let confirmedRegGateCheckedIn;
  let confirmedRegNotGateCheckedIn;
  let badgeTokenCheckedIn;
  let badgeTokenNotCheckedIn;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await SessionAttendance.deleteMany({});
      await Session.deleteMany({});
      await Registration.deleteMany({});
      await StaffAssignment.deleteMany({});
      await TicketTier.deleteMany({});
      await Venue.deleteMany({});
      await Event.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await SessionAttendance.deleteMany({});
    await Session.deleteMany({});
    await Registration.deleteMany({});
    await StaffAssignment.deleteMany({});
    await TicketTier.deleteMany({});
    await Venue.deleteMany({});
    await Event.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    // 1. Users
    organizerUser = await User.create({
      name: 'Session Organizer',
      email: 'organizer@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    organizerToken = signToken({ id: organizerUser._id.toString(), globalRole: 'user', email: organizerUser.email });

    staffUserA = await User.create({
      name: 'Room Monitor A',
      email: 'monitorA@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    staffTokenA = signToken({ id: staffUserA._id.toString(), globalRole: 'user', email: staffUserA.email });

    staffUserB = await User.create({
      name: 'Room Monitor B',
      email: 'monitorB@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    staffTokenB = signToken({ id: staffUserB._id.toString(), globalRole: 'user', email: staffUserB.email });

    attendeeUser1 = await User.create({
      name: 'Alice Attendee',
      email: 'alice@attendee.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    attendeeToken1 = signToken({ id: attendeeUser1._id.toString(), globalRole: 'user', email: attendeeUser1.email });

    attendeeUser2 = await User.create({
      name: 'Bob PendingGate',
      email: 'bob@attendee.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });

    // 2. Organization & Events
    org = await Organization.create({
      name: 'Tech Ventures Inc',
      slug: 'tech-ventures',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    eventA = await Event.create({
      organizationRef: org._id,
      organizerRef: organizerUser._id,
      title: 'Cloud Summit 2026',
      slug: 'cloud-summit-2026',
      type: 'conference',
      description: 'Cloud Summit Conference',
      totalCapacity: 500,
      status: 'published',
      startDate: new Date('2026-11-01T09:00:00Z'),
      endDate: new Date('2026-11-02T18:00:00Z')
    });

    eventB = await Event.create({
      organizationRef: org._id,
      organizerRef: organizerUser._id,
      title: 'Security Summit 2026',
      slug: 'sec-summit-2026',
      type: 'workshop',
      description: 'Security Summit Workshop',
      totalCapacity: 500,
      status: 'published',
      startDate: new Date('2026-12-01T09:00:00Z'),
      endDate: new Date('2026-12-02T18:00:00Z')
    });

    // 3. Venue & Room
    room1Id = new mongoose.Types.ObjectId();
    venueA = await Venue.create({
      organizationRef: org._id,
      name: 'Grand Convention Center',
      capacity: 500,
      address: {
        street: '100 Main St',
        city: 'San Francisco',
        country: 'USA'
      },
      rooms: [
        {
          _id: room1Id,
          name: 'Main Auditorium',
          capacity: 100
        }
      ]
    });

    // 4. Sessions
    sessionA1 = await Session.create({
      eventRef: eventA._id,
      title: 'Opening Keynote: Distributed Systems',
      roomId: room1Id,
      roomName: 'Main Auditorium',
      startTime: new Date('2026-11-01T10:00:00Z'),
      endTime: new Date('2026-11-01T11:00:00Z'),
      capacityLimit: 50,
      enrolledCount: 0
    });

    sessionA2 = await Session.create({
      eventRef: eventA._id,
      title: 'Workshop: Micro-Capacity Room',
      roomId: room1Id,
      roomName: 'Main Auditorium',
      startTime: new Date('2026-11-01T14:00:00Z'),
      endTime: new Date('2026-11-01T15:00:00Z'),
      capacityLimit: 2, // Tiny capacity for concurrency testing
      enrolledCount: 0
    });

    sessionB1 = await Session.create({
      eventRef: eventB._id,
      title: 'Zero Trust Architectures',
      roomId: room1Id,
      roomName: 'Main Auditorium',
      startTime: new Date('2026-12-01T10:00:00Z'),
      endTime: new Date('2026-12-01T11:00:00Z'),
      capacityLimit: 50,
      enrolledCount: 0
    });

    // 5. TicketTier
    tierA = await TicketTier.create({
      eventRef: eventA._id,
      name: 'Standard Pass',
      price: 200,
      totalQuantity: 100,
      salesStart: new Date('2026-01-01T00:00:00Z'),
      salesEnd: new Date('2026-12-31T23:59:59Z'),
      status: 'active'
    });

    // 6. Staff assignments
    await StaffAssignment.create({
      eventRef: eventA._id,
      userRef: staffUserA._id,
      role: 'room_monitor',
      status: 'active'
    });

    await StaffAssignment.create({
      eventRef: eventB._id,
      userRef: staffUserB._id,
      role: 'room_monitor',
      status: 'active'
    });

    // 7. Registrations: one gate-checked-in, one not gate-checked-in
    confirmedRegGateCheckedIn = await Registration.create({
      eventRef: eventA._id,
      userRef: attendeeUser1._id,
      ticketTierRef: tierA._id,
      registrationNumber: 'EF-REG-SESS-001',
      quantity: 1,
      totalAmount: 200,
      discountAmount: 0,
      finalAmount: 200,
      status: 'confirmed',
      paymentStatus: 'paid',
      attendeeDetails: {
        firstName: 'Alice',
        lastName: 'Attendee',
        email: 'alice@attendee.com'
      },
      attendeePasses: [
        {
          passNumber: 'EF-REG-SESS-001-1',
          holderName: 'Alice Attendee',
          holderEmail: 'alice@attendee.com',
          checkedIn: true, // Already checked in at gate
          checkedInAt: new Date()
        }
      ]
    });

    confirmedRegNotGateCheckedIn = await Registration.create({
      eventRef: eventA._id,
      userRef: attendeeUser2._id,
      ticketTierRef: tierA._id,
      registrationNumber: 'EF-REG-SESS-002',
      quantity: 1,
      totalAmount: 200,
      discountAmount: 0,
      finalAmount: 200,
      status: 'confirmed',
      paymentStatus: 'paid',
      attendeeDetails: {
        firstName: 'Bob',
        lastName: 'PendingGate',
        email: 'bob@attendee.com'
      },
      attendeePasses: [
        {
          passNumber: 'EF-REG-SESS-002-1',
          holderName: 'Bob PendingGate',
          holderEmail: 'bob@attendee.com',
          checkedIn: false // NOT checked in at gate
        }
      ]
    });

    badgeTokenCheckedIn = QRVerificationEngine.signBadgeToken({
      passNumber: 'EF-REG-SESS-001-1',
      regNum: confirmedRegGateCheckedIn.registrationNumber,
      eventId: eventA._id,
      userId: attendeeUser1._id,
      tierId: tierA._id
    });

    badgeTokenNotCheckedIn = QRVerificationEngine.signBadgeToken({
      passNumber: 'EF-REG-SESS-002-1',
      regNum: confirmedRegNotGateCheckedIn.registrationNumber,
      eventId: eventA._id,
      userId: attendeeUser2._id,
      tierId: tierA._id
    });
  });

  describe('Session Admission & Prerequisites', () => {
    it('should reject session admission if attendee has not checked in at the main gate (400 GATE_CHECKIN_REQUIRED)', async () => {
      const res = await request(app)
        .post('/api/v1/checkin/session')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          token: badgeTokenNotCheckedIn,
          sessionId: sessionA1._id.toString()
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'GATE_CHECKIN_REQUIRED');

      // Verify no attendance created and enrolledCount not changed
      const count = await SessionAttendance.countDocuments({ sessionRef: sessionA1._id });
      assert.equal(count, 0);
      const updatedSession = await Session.findById(sessionA1._id);
      assert.equal(updatedSession.enrolledCount, 0);
    });

    it('should successfully admit a gate-checked-in attendee to session (200 OK, enrolledCount incremented)', async () => {
      const res = await request(app)
        .post('/api/v1/checkin/session')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          token: badgeTokenCheckedIn,
          sessionId: sessionA1._id.toString()
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'admitted');

      // Verify SessionAttendance record
      const attendance = await SessionAttendance.findOne({
        sessionRef: sessionA1._id,
        'attendeePass.passNumber': 'EF-REG-SESS-001-1'
      });
      assert.ok(attendance);
      assert.equal(attendance.userRef.toString(), attendeeUser1._id.toString());
      assert.equal(attendance.scannedByStaffRef.toString(), staffUserA._id.toString());

      // Verify Session enrolledCount
      const updatedSession = await Session.findById(sessionA1._id);
      assert.equal(updatedSession.enrolledCount, 1);
    });

    it('should return already_attended on duplicate scan and not increment enrolledCount (200 OK)', async () => {
      // First scan
      const first = await request(app)
        .post('/api/v1/checkin/session')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          token: badgeTokenCheckedIn,
          sessionId: sessionA1._id.toString()
        });
      assert.equal(first.status, 200);
      assert.equal(first.body.data.status, 'admitted');

      // Second scan
      const second = await request(app)
        .post('/api/v1/checkin/session')
        .set('Authorization', `Bearer ${staffTokenA}`)
        .send({
          token: badgeTokenCheckedIn,
          sessionId: sessionA1._id.toString()
        });

      assert.equal(second.status, 200);
      assert.equal(second.body.success, true);
      assert.equal(second.body.data.status, 'already_attended');

      // enrolledCount must remain 1
      const updatedSession = await Session.findById(sessionA1._id);
      assert.equal(updatedSession.enrolledCount, 1);
    });
  });

  describe('Session Concurrency Protections', () => {
    it('Scenario 1: 20 concurrent scan requests for the same pass -> exactly 1 attendance record created', async () => {
      const requests = Array.from({ length: 20 }, () =>
        request(app)
          .post('/api/v1/checkin/session')
          .set('Authorization', `Bearer ${staffTokenA}`)
          .send({
            token: badgeTokenCheckedIn,
            sessionId: sessionA1._id.toString()
          })
      );

      const responses = await Promise.all(requests);
      assert.equal(responses.every((r) => r.status === 200), true);

      const admittedCount = responses.filter((r) => r.body.data?.status === 'admitted').length;
      const alreadyAttendedCount = responses.filter((r) => r.body.data?.status === 'already_attended').length;

      assert.equal(admittedCount, 1, 'Exactly 1 request should be admitted');
      assert.equal(alreadyAttendedCount, 19, '19 requests should receive already_attended');

      const attendances = await SessionAttendance.find({
        sessionRef: sessionA1._id,
        'attendeePass.passNumber': 'EF-REG-SESS-001-1'
      });
      assert.equal(attendances.length, 1);

      const updatedSession = await Session.findById(sessionA1._id);
      assert.equal(updatedSession.enrolledCount, 1);
    });

    it('Scenario 2: Session capacity = 2, 5 concurrent distinct attendees compete -> exactly 2 admitted, 3 rejected with 409', async () => {
      // Create 5 distinct attendees with gate-checked-in passes
      const competitors = await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          const user = await User.create({
            name: `Competitor ${i}`,
            email: `comp${i}@test.com`,
            passwordHash: 'Password123!',
            globalRole: 'user'
          });

          const reg = await Registration.create({
            eventRef: eventA._id,
            userRef: user._id,
            ticketTierRef: tierA._id,
            registrationNumber: `EF-COMP-REG-${i}`,
            quantity: 1,
            totalAmount: 200,
            discountAmount: 0,
            finalAmount: 200,
            status: 'confirmed',
            paymentStatus: 'paid',
            attendeeDetails: {
              firstName: `Comp${i}`,
              lastName: 'User',
              email: `comp${i}@test.com`
            },
            attendeePasses: [
              {
                passNumber: `EF-COMP-PASS-${i}`,
                holderName: `Comp${i} User`,
                holderEmail: `comp${i}@test.com`,
                checkedIn: true // Gate checked in
              }
            ]
          });

          const token = QRVerificationEngine.signBadgeToken({
            passNumber: `EF-COMP-PASS-${i}`,
            regNum: reg.registrationNumber,
            eventId: eventA._id,
            userId: user._id,
            tierId: tierA._id
          });

          return { user, reg, token };
        })
      );

      // Fire 5 concurrent requests against sessionA2 (capacity = 2)
      const responses = await Promise.all(
        competitors.map((c) =>
          request(app)
            .post('/api/v1/checkin/session')
            .set('Authorization', `Bearer ${staffTokenA}`)
            .send({
              token: c.token,
              sessionId: sessionA2._id.toString()
            })
        )
      );

      const admitted = responses.filter((r) => r.status === 200 && r.body.data?.status === 'admitted');
      const rejected = responses.filter((r) => r.status === 409 && r.body.error?.code === 'SESSION_FULL');

      assert.equal(admitted.length, 2, 'Exactly 2 competitors should be admitted to fill capacity');
      assert.equal(rejected.length, 3, 'Exactly 3 competitors should be rejected with 409 SESSION_FULL');

      // Final session enrolledCount must equal exactly capacityLimit (2)
      const finalSession = await Session.findById(sessionA2._id);
      assert.equal(finalSession.enrolledCount, 2);
      assert.ok(finalSession.enrolledCount <= finalSession.capacityLimit);

      // Verify total attendance records
      const totalAttendance = await SessionAttendance.countDocuments({ sessionRef: sessionA2._id });
      assert.equal(totalAttendance, 2);
    });
  });

  describe('Cross-Event and RBAC Isolation', () => {
    it('should reject scanning Event A badge at an Event B session (400 SESSION_EVENT_MISMATCH)', async () => {
      const res = await request(app)
        .post('/api/v1/checkin/session')
        .set('Authorization', `Bearer ${staffTokenB}`)
        .send({
          token: badgeTokenCheckedIn, // Event A badge
          sessionId: sessionB1._id.toString() // Event B session
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'SESSION_EVENT_MISMATCH');
    });

    it('should forbid Event B staff from scanning attendees into Event A session (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/checkin/session')
        .set('Authorization', `Bearer ${staffTokenB}`) // Staff assigned only to Event B
        .send({
          token: badgeTokenCheckedIn,
          sessionId: sessionA1._id.toString() // Event A session
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });
  });
});
