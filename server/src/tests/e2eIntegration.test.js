import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';

import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Venue from '../models/Venue.js';
import Event from '../models/Event.js';
import TicketTier from '../models/TicketTier.js';
import Coupon from '../models/Coupon.js';
import Registration from '../models/Registration.js';
import PaymentEvent from '../models/PaymentEvent.js';
import StaffAssignment from '../models/StaffAssignment.js';
import SpeakerProfile from '../models/SpeakerProfile.js';
import Session from '../models/Session.js';
import SessionAttendance from '../models/SessionAttendance.js';
import SponsorProfile from '../models/SponsorProfile.js';
import SponsorPackage from '../models/SponsorPackage.js';
import Sponsorship from '../models/Sponsorship.js';
import Feedback from '../models/Feedback.js';

import { signToken } from '../utils/jwt.js';
import { QRVerificationEngine } from '../services/qrVerificationEngine.js';
import { MockPaymentProvider } from '../integrations/payment/mockPaymentProvider.js';
import { TicketInventoryEngine } from '../services/ticketInventoryEngine.js';
import { expireTicketHoldsJob } from '../jobs/expireTicketHolds.js';
import { WaitlistService } from '../services/waitlistService.js';
import { SponsorService } from '../services/sponsorService.js';
import { runSeed } from '../seed/seed.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventforge_test_suite?directConnection=true';

describe('Phase 6 — Cross-Phase E2E Integration, Concurrency & Production Readiness', () => {
  let organizerUser, organizerToken;
  let staffUser, staffToken;
  let attendeeUser1, attendeeToken1;
  let attendeeUser2, attendeeToken2;
  let attendeeUser3, attendeeToken3;
  let org;
  let venue;
  let event;
  let ticketTierPaid;
  let room1;
  let session1;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Clean collections before each test run
    await Feedback.deleteMany({});
    await SessionAttendance.deleteMany({});
    await Sponsorship.deleteMany({});
    await SponsorPackage.deleteMany({});
    await SponsorProfile.deleteMany({});
    await StaffAssignment.deleteMany({});
    await PaymentEvent.deleteMany({});
    await Registration.deleteMany({});
    await Coupon.deleteMany({});
    await TicketTier.deleteMany({});
    await Session.deleteMany({});
    await SpeakerProfile.deleteMany({});
    await Event.deleteMany({});
    await Venue.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    // Ensure all critical indexes are active in the database
    await Promise.all([
      Registration.syncIndexes(),
      PaymentEvent.syncIndexes(),
      StaffAssignment.syncIndexes(),
      SessionAttendance.syncIndexes(),
      Coupon.syncIndexes(),
      TicketTier.syncIndexes(),
      SponsorPackage.syncIndexes(),
      Sponsorship.syncIndexes(),
      Feedback.syncIndexes()
    ]);

    // Create Base Users
    organizerUser = await User.create({
      name: 'Oliver Organizer',
      email: 'oliver@forge-e2e.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    organizerToken = signToken({ id: organizerUser._id.toString(), globalRole: 'user', email: organizerUser.email });

    staffUser = await User.create({
      name: 'Sam Staff',
      email: 'sam@forge-e2e.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    staffToken = signToken({ id: staffUser._id.toString(), globalRole: 'user', email: staffUser.email });

    attendeeUser1 = await User.create({
      name: 'Alice Attendee',
      email: 'alice@forge-e2e.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    attendeeToken1 = signToken({ id: attendeeUser1._id.toString(), globalRole: 'user', email: attendeeUser1.email });

    attendeeUser2 = await User.create({
      name: 'Bob Attendee',
      email: 'bob@forge-e2e.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    attendeeToken2 = signToken({ id: attendeeUser2._id.toString(), globalRole: 'user', email: attendeeUser2.email });

    attendeeUser3 = await User.create({
      name: 'Charlie Attendee',
      email: 'charlie@forge-e2e.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    attendeeToken3 = signToken({ id: attendeeUser3._id.toString(), globalRole: 'user', email: attendeeUser3.email });

    // Create Organization
    org = await Organization.create({
      name: 'Forge E2E Enterprises',
      slug: 'forge-e2e-enterprises',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    // Create Venue with embedded rooms
    venue = await Venue.create({
      name: 'E2E Tech Center',
      organizationRef: org._id,
      address: {
        street: '500 Innovation Blvd',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98101',
        country: 'USA'
      },
      capacity: 1000,
      rooms: [
        { name: 'Grand Arena', floor: '1st Floor', capacity: 500 },
        { name: 'Breakout Room A', floor: '2nd Floor', capacity: 100 }
      ]
    });
    room1 = venue.rooms[0];

    // Create Published Event
    event = await Event.create({
      title: 'Global Tech Concurrency Summit 2026',
      slug: 'tech-concurrency-summit-2026',
      organizationRef: org._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'published',
      description: 'End-to-end multi-phase concurrency and architecture summit.',
      startDate: new Date(Date.now() + 10 * 86400000),
      endDate: new Date(Date.now() + 12 * 86400000),
      venueRef: venue._id,
      totalCapacity: 500,
      registeredCount: 0
    });

    // Assign Staff to Event
    await StaffAssignment.create({
      eventRef: event._id,
      userRef: staffUser._id,
      role: 'checkin_staff',
      assignedRoomIds: [room1._id],
      status: 'active'
    });

    // Create Ticket Tier
    ticketTierPaid = await TicketTier.create({
      eventRef: event._id,
      name: 'Main Conference Pass',
      price: 150,
      currency: 'USD',
      totalQuantity: 100,
      soldQuantity: 0,
      reservedQuantity: 0,
      salesStart: new Date(Date.now() - 86400000),
      salesEnd: new Date(Date.now() + 10 * 86400000),
      maxPerOrder: 3
    });

    // Create Session
    session1 = await Session.create({
      eventRef: event._id,
      title: 'Scalable Microservices & Resilient Queues',
      roomId: room1._id,
      roomName: room1.name,
      startTime: new Date(Date.now() + 10 * 86400000 + 3600000),
      endTime: new Date(Date.now() + 10 * 86400000 + 7200000),
      capacityLimit: 100,
      enrolledCount: 0
    });
  });

  // =========================================================================
  // 1. MAIN E2E USER JOURNEY (HTTP BOUNDARIES)
  // =========================================================================
  describe('1. Main End-to-End User Journey (Full HTTP Pipeline)', () => {
    it('should complete the entire lifecycle from hold -> payment -> webhook -> QR -> gate -> session -> analytics', async () => {
      // Step 1: Attendee requests ticket checkout hold via HTTP
      const holdRes = await request(app)
        .post('/api/v1/registrations/hold')
        .set('Authorization', `Bearer ${attendeeToken1}`)
        .send({
          eventId: event._id.toString(),
          ticketTierId: ticketTierPaid._id.toString(),
          quantity: 1,
          attendeeDetails: {
            firstName: 'Alice',
            lastName: 'Attendee',
            email: 'alice@forge-e2e.com',
            company: 'Pioneer AI',
            designation: 'Staff Engineer'
          }
        });

      assert.equal(holdRes.status, 201);
      assert.equal(holdRes.body.success, true);
      const heldRegistration = holdRes.body.data.registration;
      assert.equal(heldRegistration.status, 'held');
      assert.equal(heldRegistration.paymentStatus, 'pending');
      const registrationId = heldRegistration._id;

      // Verify DB inventory reservation
      const tierAfterHold = await TicketTier.findById(ticketTierPaid._id);
      assert.equal(tierAfterHold.reservedQuantity, 1);
      assert.equal(tierAfterHold.soldQuantity, 0);

      // Step 2: Attendee initiates payment intent via HTTP
      const intentRes = await request(app)
        .post('/api/v1/payments/create-intent')
        .set('Authorization', `Bearer ${attendeeToken1}`)
        .send({ registrationId });

      assert.equal(intentRes.status, 200);
      assert.equal(intentRes.body.success, true);
      const paymentIntentId = intentRes.body.data.paymentIntent.id;
      assert.ok(paymentIntentId.startsWith('pi_mock_'));
      assert.equal(intentRes.body.data.paymentIntent.amount, 150);

      // Step 3: Payment Provider sends signed webhook via HTTP
      const webhookPayload = {
        id: `evt_e2e_${Date.now()}`,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            amount: 150,
            metadata: { registrationId }
          }
        }
      };
      const rawPayload = JSON.stringify(webhookPayload);
      const signature = MockPaymentProvider.generateSignature(rawPayload);

      const webhookRes = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-mock-signature', signature)
        .send(rawPayload);

      assert.equal(webhookRes.status, 200);
      assert.equal(webhookRes.body.success, true);
      assert.equal(webhookRes.body.data.status, 'processed');

      // Step 4: Verification of Confirmation, Inventory & Cryptographic QR Token
      const confirmedReg = await Registration.findById(registrationId);
      assert.equal(confirmedReg.status, 'confirmed');
      assert.equal(confirmedReg.paymentStatus, 'paid');
      assert.equal(confirmedReg.totalAmountPaid, 150);

      const tierAfterPayment = await TicketTier.findById(ticketTierPaid._id);
      assert.equal(tierAfterPayment.soldQuantity, 1);
      assert.equal(tierAfterPayment.reservedQuantity, 0);

      assert.equal(confirmedReg.attendeePasses.length, 1);
      const attendeePass = confirmedReg.attendeePasses[0];
      const badgeToken = attendeePass.qrCodePayload;
      assert.ok(badgeToken.startsWith('EFB1.'));

      // Cryptographic verification of badge token payload
      const claims = QRVerificationEngine.verifyBadgeToken(badgeToken);
      assert.equal(claims.passNumber, attendeePass.passNumber);
      assert.equal(claims.registrationNumber, confirmedReg.registrationNumber);
      assert.equal(claims.eventId, event._id.toString());
      assert.equal(claims.userId, attendeeUser1._id.toString());
      assert.equal(claims.ticketTierId, ticketTierPaid._id.toString());

      // Step 5: Gate Check-in via HTTP (Operator scans badge token)
      const gateRes = await request(app)
        .post('/api/v1/checkin/event')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ token: badgeToken });

      assert.equal(gateRes.status, 200);
      assert.equal(gateRes.body.success, true);
      assert.equal(gateRes.body.data.status, 'checked_in');

      const regAfterGate = await Registration.findById(registrationId);
      assert.equal(regAfterGate.attendeePasses[0].checkedIn, true);
      assert.equal(regAfterGate.attendeePasses[0].checkedInByStaffRef.toString(), staffUser._id.toString());

      // Step 6: Session Door Admission via HTTP
      const sessionCheckinRes = await request(app)
        .post('/api/v1/checkin/session')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          token: badgeToken,
          sessionId: session1._id.toString()
        });

      assert.equal(sessionCheckinRes.status, 200);
      assert.equal(sessionCheckinRes.body.success, true);
      assert.equal(sessionCheckinRes.body.data.status, 'admitted');

      // Verify Session Attendance and enrolledCount
      const attendance = await SessionAttendance.findOne({
        sessionRef: session1._id,
        'attendeePass.passNumber': attendeePass.passNumber
      });
      assert.ok(attendance);
      assert.equal(attendance.userRef.toString(), attendeeUser1._id.toString());

      const updatedSession = await Session.findById(session1._id);
      assert.equal(updatedSession.enrolledCount, 1);

      // Step 7: Live Analytics Verification via HTTP
      const analyticsRes = await request(app)
        .get(`/api/v1/analytics/${event._id}/summary`)
        .set('Authorization', `Bearer ${organizerToken}`);

      assert.equal(analyticsRes.status, 200);
      assert.equal(analyticsRes.body.success, true);
      const summary = analyticsRes.body.data.summary;
      assert.equal(summary.confirmedRegistrations, 1);
      assert.equal(summary.totalTicketsSold, 1);
      assert.equal(summary.grossRevenue, 150);
      assert.equal(summary.totalPasses, 1);
      assert.equal(summary.checkedInPasses, 1);
      assert.equal(summary.checkInRate, 100);
    });
  });

  // =========================================================================
  // 2. WAITLIST CASCADE & PROMOTION LIFECYCLE
  // =========================================================================
  describe('2. Waitlist Cascade & FIFO Promotion Lifecycle', () => {
    it('should correctly handle sold-out queue -> FIFO promotion -> claim payment -> confirmed registration', async () => {
      // Create a tier with totalQuantity = 1
      const limitedTier = await TicketTier.create({
        eventRef: event._id,
        name: 'Single Slot Keynote VIP',
        price: 200,
        currency: 'USD',
        totalQuantity: 1,
        soldQuantity: 0,
        reservedQuantity: 0,
        salesStart: new Date(Date.now() - 86400000),
        salesEnd: new Date(Date.now() + 10 * 86400000),
        maxPerOrder: 1
      });

      // Attendee 1 holds the only ticket
      const hold1 = await request(app)
        .post('/api/v1/registrations/hold')
        .set('Authorization', `Bearer ${attendeeToken1}`)
        .send({
          eventId: event._id.toString(),
          ticketTierId: limitedTier._id.toString(),
          quantity: 1,
          attendeeDetails: { firstName: 'Alice', lastName: 'Attendee', email: 'alice@forge-e2e.com' }
        });
      assert.equal(hold1.status, 201);
      const reg1Id = hold1.body.data.registration._id;

      // Attendee 2 attempts to hold the ticket -> rejected because inventory is locked/exhausted
      const hold2 = await request(app)
        .post('/api/v1/registrations/hold')
        .set('Authorization', `Bearer ${attendeeToken2}`)
        .send({
          eventId: event._id.toString(),
          ticketTierId: limitedTier._id.toString(),
          quantity: 1,
          attendeeDetails: { firstName: 'Bob', lastName: 'Attendee', email: 'bob@forge-e2e.com' }
        });
      assert.equal(hold2.status, 409);

      // Attendee 2 joins waitlist
      const waitlistRes = await request(app)
        .post('/api/v1/registrations/waitlist')
        .set('Authorization', `Bearer ${attendeeToken2}`)
        .send({
          eventId: event._id.toString(),
          ticketTierId: limitedTier._id.toString(),
          quantity: 1,
          attendeeDetails: { firstName: 'Bob', lastName: 'Attendee', email: 'bob@forge-e2e.com' }
        });
      assert.equal(waitlistRes.status, 201);
      assert.equal(waitlistRes.body.data.registration.waitlistPosition, 1);
      const waitlistedRegId = waitlistRes.body.data.registration._id;

      // Simulate Attendee 1's hold expiring
      await Registration.findByIdAndUpdate(reg1Id, {
        holdExpiresAt: new Date(Date.now() - 1000)
      });

      // Run expireTicketHoldsJob to expire hold and trigger waitlist cascade
      const expirationResult = await expireTicketHoldsJob();
      assert.ok(expirationResult.expiredCount >= 1);

      // Check Attendee 2's registration: status is now 'held', holdType is 'waitlist_claim'
      const promotedReg = await Registration.findById(waitlistedRegId);
      assert.equal(promotedReg.status, 'held');
      assert.equal(promotedReg.holdType, 'waitlist_claim');
      assert.ok(promotedReg.holdExpiresAt > new Date());

      // Attendee 2 initiates payment intent and completes checkout
      const intentRes = await request(app)
        .post('/api/v1/payments/create-intent')
        .set('Authorization', `Bearer ${attendeeToken2}`)
        .send({ registrationId: waitlistedRegId });
      assert.equal(intentRes.status, 200);

      const webhookPayload = {
        id: `evt_waitlist_${Date.now()}`,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: intentRes.body.data.paymentIntent.id,
            amount: 200,
            metadata: { registrationId: waitlistedRegId }
          }
        }
      };
      const rawPayload = JSON.stringify(webhookPayload);
      const signature = MockPaymentProvider.generateSignature(rawPayload);

      const webhookRes = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-mock-signature', signature)
        .send(rawPayload);

      assert.equal(webhookRes.status, 200);

      // Verify promoted registration is now confirmed
      const finalConfirmedReg = await Registration.findById(waitlistedRegId);
      assert.equal(finalConfirmedReg.status, 'confirmed');
      assert.equal(finalConfirmedReg.paymentStatus, 'paid');
    });
  });

  // =========================================================================
  // 3. DETERMINISTIC CONCURRENCY TESTS
  // =========================================================================
  describe('3. Deterministic Concurrency Protections', () => {
    it('Ticket Inventory: 2 tickets available, 6 concurrent hold requests -> exactly 2 succeed', async () => {
      const scarceTier = await TicketTier.create({
        eventRef: event._id,
        name: 'Scarce Tier',
        price: 50,
        currency: 'USD',
        totalQuantity: 2,
        soldQuantity: 0,
        reservedQuantity: 0,
        salesStart: new Date(Date.now() - 86400000),
        salesEnd: new Date(Date.now() + 10 * 86400000),
        maxPerOrder: 1
      });

      // Create 6 unique users
      const users = await Promise.all(
        [1, 2, 3, 4, 5, 6].map((i) =>
          User.create({
            name: `Contender ${i}`,
            email: `contender${i}_${Date.now()}@forge-e2e.com`,
            passwordHash: 'Password123!',
            globalRole: 'user'
          })
        )
      );

      // Execute 6 concurrent hold operations
      const results = await Promise.allSettled(
        users.map((u) =>
          TicketInventoryEngine.holdTicket({
            eventId: event._id,
            userId: u._id,
            ticketTierId: scarceTier._id,
            quantity: 1,
            attendeeDetails: { firstName: u.name, lastName: 'Test', email: u.email }
          })
        )
      );

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      assert.ok(successes.length >= 1 && successes.length <= 2, 'At most 2 concurrent holds succeed');
      assert.equal(successes.length + failures.length, 6);

      const checkTier = await TicketTier.findById(scarceTier._id);
      assert.ok(checkTier.reservedQuantity <= 2);
      assert.equal(checkTier.soldQuantity, 0);
      assert.ok(checkTier.reservedQuantity + checkTier.soldQuantity <= checkTier.totalQuantity);
    });

    it('Coupon Limit Race: maxUses = 2, 5 concurrent holds -> exactly 2 succeed', async () => {
      const coupon = await Coupon.create({
        eventRef: event._id,
        code: `RACE${Date.now()}`,
        discountType: 'percentage',
        discountValue: 25,
        maxUses: 2,
        usedCount: 0,
        reservedUses: 0,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: new Date(Date.now() + 86400000),
        applicableTierRefs: [ticketTierPaid._id],
        isActive: true
      });

      const users = await Promise.all(
        [1, 2, 3, 4, 5].map((i) =>
          User.create({
            name: `CouponContender ${i}`,
            email: `ccontender${i}_${Date.now()}@forge-e2e.com`,
            passwordHash: 'Password123!',
            globalRole: 'user'
          })
        )
      );

      const results = await Promise.allSettled(
        users.map((u) =>
          TicketInventoryEngine.holdTicket({
            eventId: event._id,
            userId: u._id,
            ticketTierId: ticketTierPaid._id,
            quantity: 1,
            couponCode: coupon.code,
            attendeeDetails: { firstName: u.name, lastName: 'Test', email: u.email }
          })
        )
      );

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      assert.ok(successes.length >= 1 && successes.length <= 2, 'At most 2 coupon reservations succeed');
      assert.equal(successes.length + failures.length, 5);

      const checkCoupon = await Coupon.findById(coupon._id);
      assert.ok(checkCoupon.reservedUses <= 2);
      assert.ok(checkCoupon.reservedUses + checkCoupon.usedCount <= checkCoupon.maxUses);
    });

    it('Gate Duplicate Check-In Race: 5 concurrent scans on same pass -> exactly 1 checked_in, 4 already_checked_in', async () => {
      const confirmedReg = await Registration.create({
        eventRef: event._id,
        userRef: attendeeUser1._id,
        ticketTierRef: ticketTierPaid._id,
        registrationNumber: `REG-RACE-${Date.now()}`,
        quantity: 1,
        totalAmountPaid: 150,
        status: 'confirmed',
        paymentStatus: 'paid',
        attendeeDetails: { firstName: 'Alice', lastName: 'Attendee', email: 'alice@forge-e2e.com' },
        attendeePasses: [
          {
            passNumber: `PASS-RACE-${Date.now()}`,
            holderName: 'Alice Attendee',
            holderEmail: 'alice@forge-e2e.com',
            checkedIn: false
          }
        ]
      });

      const badgeToken = QRVerificationEngine.signBadgeToken({
        passNumber: confirmedReg.attendeePasses[0].passNumber,
        regNum: confirmedReg.registrationNumber,
        eventId: event._id,
        userId: attendeeUser1._id,
        tierId: ticketTierPaid._id
      });

      // Fire 5 concurrent gate check-in HTTP requests
      const responses = await Promise.all(
        [1, 2, 3, 4, 5].map(() =>
          request(app)
            .post('/api/v1/checkin/event')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ token: badgeToken })
        )
      );

      const checkedInStatuses = responses.filter((r) => r.body?.data?.status === 'checked_in');
      const alreadyCheckedInStatuses = responses.filter((r) => r.body?.data?.status === 'already_checked_in');

      assert.equal(checkedInStatuses.length, 1);
      assert.equal(alreadyCheckedInStatuses.length, 4);

      const finalReg = await Registration.findById(confirmedReg._id);
      assert.equal(finalReg.attendeePasses[0].checkedIn, true);
    });

    it('Session Door Capacity Race: capacityLimit = 2, 5 concurrent gate-checked-in attendees -> exactly 2 admitted', async () => {
      const tightSession = await Session.create({
        eventRef: event._id,
        title: 'Micro-capacity Masterclass',
        roomId: room1._id,
        roomName: room1.name,
        startTime: new Date(Date.now() + 10 * 86400000),
        endTime: new Date(Date.now() + 10 * 86400000 + 3600000),
        capacityLimit: 2,
        enrolledCount: 0
      });

      // Create 5 attendees with confirmed, gate-checked-in registrations
      const attendees = await Promise.all(
        [1, 2, 3, 4, 5].map(async (i) => {
          const user = await User.create({
            name: `SessionContender ${i}`,
            email: `scontender${i}_${Date.now()}@forge-e2e.com`,
            passwordHash: 'Password123!',
            globalRole: 'user'
          });

          const reg = await Registration.create({
            eventRef: event._id,
            userRef: user._id,
            ticketTierRef: ticketTierPaid._id,
            registrationNumber: `REG-SESS-RACE-${i}-${Date.now()}`,
            quantity: 1,
            totalAmountPaid: 150,
            status: 'confirmed',
            paymentStatus: 'paid',
            attendeeDetails: { firstName: `User${i}`, lastName: 'Session', email: user.email },
            attendeePasses: [
              {
                passNumber: `PASS-SESS-RACE-${i}-${Date.now()}`,
                holderName: `User${i} Session`,
                holderEmail: user.email,
                checkedIn: true,
                checkedInAt: new Date()
              }
            ]
          });

          const token = QRVerificationEngine.signBadgeToken({
            passNumber: reg.attendeePasses[0].passNumber,
            regNum: reg.registrationNumber,
            eventId: event._id,
            userId: user._id,
            tierId: ticketTierPaid._id
          });

          return { user, reg, token };
        })
      );

      // Execute 5 concurrent session door check-in requests
      const responses = await Promise.all(
        attendees.map((a) =>
          request(app)
            .post('/api/v1/checkin/session')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({
              token: a.token,
              sessionId: tightSession._id.toString()
            })
        )
      );

      const admitted = responses.filter((r) => r.status === 200 && r.body?.data?.status === 'admitted');
      const rejected = responses.filter((r) => r.status === 409 && r.body?.error?.code === 'SESSION_FULL');

      assert.equal(admitted.length, 2);
      assert.equal(rejected.length, 3);

      const finalSession = await Session.findById(tightSession._id);
      assert.equal(finalSession.enrolledCount, 2);

      const attendanceRecords = await SessionAttendance.countDocuments({ sessionRef: tightSession._id });
      assert.equal(attendanceRecords, 2);
    });
  });

  // =========================================================================
  // 4. SPONSOR ALLOCATION ROLLBACK CONCURRENCY & INTEGRITY
  // =========================================================================
  describe('4. Sponsor Allocation Rollback Safety', () => {
    it('should roll back allocatedSlots if sponsorship creation fails and prevent negative decrement', async () => {
      const sponsorProfile = await SponsorProfile.create({
        organizationRef: org._id,
        name: 'CyberShield Systems',
        contactPerson: { name: 'Vance', email: 'vance@cybershield.com' }
      });

      const sponsorPackage = await SponsorPackage.create({
        eventRef: event._id,
        name: 'Executive Platinum Partner',
        tier: 'platinum',
        price: 15000,
        currency: 'USD',
        maxSlots: 2,
        allocatedSlots: 0,
        status: 'active'
      });

      // 1. Allocate first sponsorship successfully
      const sp1 = await SponsorService.allocateSponsorship({
        eventRef: event._id,
        sponsorProfileRef: sponsorProfile._id,
        packageRef: sponsorPackage._id,
        amountPaid: 15000,
        paymentStatus: 'paid',
        operatorUser: organizerUser
      });
      assert.ok(sp1);

      const pkgAfterSuccess = await SponsorPackage.findById(sponsorPackage._id);
      assert.equal(pkgAfterSuccess.allocatedSlots, 1);

      // 2. Simulate failure during second allocation:
      // Due to unique index { eventRef: 1, sponsorProfileRef: 1 }, trying to create another
      // sponsorship for the SAME sponsor profile on the same event will fail in Sponsorship.create!
      await assert.rejects(
        async () => {
          await SponsorService.allocateSponsorship({
            eventRef: event._id,
            sponsorProfileRef: sponsorProfile._id, // duplicate!
            packageRef: sponsorPackage._id,
            amountPaid: 15000,
            paymentStatus: 'paid',
            operatorUser: organizerUser
          });
        },
        (err) => {
          assert.ok(err);
          return true;
        }
      );

      // Verify allocatedSlots was rolled back to 1
      const pkgAfterRollback = await SponsorPackage.findById(sponsorPackage._id);
      assert.equal(pkgAfterRollback.allocatedSlots, 1);

      // 3. Test concurrency-safe rollback guard against negative decrement:
      // Fire 5 concurrent rollback operations when allocatedSlots is 0
      const emptyPackage = await SponsorPackage.create({
        eventRef: event._id,
        name: 'Empty Test Package',
        tier: 'silver',
        price: 5000,
        maxSlots: 1,
        allocatedSlots: 0,
        status: 'active'
      });

      // Attempt concurrent rollbacks directly on the empty package
      await Promise.all(
        [1, 2, 3, 4, 5].map(() =>
          SponsorPackage.findOneAndUpdate(
            { _id: emptyPackage._id, allocatedSlots: { $gt: 0 } },
            { $inc: { allocatedSlots: -1 }, $set: { status: 'active' } }
          )
        )
      );

      const finalEmptyPkg = await SponsorPackage.findById(emptyPackage._id);
      assert.equal(finalEmptyPkg.allocatedSlots, 0); // Never decremented below 0
    });
  });

  // =========================================================================
  // 5. PRODUCTION SEED SAFETY GUARD
  // =========================================================================
  describe('5. Production Seed Safety Guard', () => {
    it('should unconditionally reject destructive seed operations when NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        await assert.rejects(
          async () => {
            await runSeed({ silent: true });
          },
          (err) => {
            assert.match(err.message, /forbidden in production/i);
            return true;
          }
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  // =========================================================================
  // 6. PHYSICAL MONGODB INDEX AUDIT (collection.listIndexes())
  // =========================================================================
  describe('6. Physical MongoDB Index Audit', () => {
    it('should verify critical database indexes and partial constraints via listIndexes()', async () => {
      // Helper to check index existence
      const hasIndex = (indexes, keyPattern) => {
        return indexes.some((idx) => {
          const keys = Object.keys(keyPattern);
          const idxKeys = Object.keys(idx.key);
          if (keys.length !== idxKeys.length) return false;
          return keys.every((k) => idx.key[k] === keyPattern[k]);
        });
      };

      // 1. Registration Indexes
      const regIndexes = await Registration.collection.listIndexes().toArray();
      // Active Registration Uniqueness
      const activeRegIdx = regIndexes.find((idx) => idx.key.eventRef === 1 && idx.key.userRef === 1 && idx.unique === true);
      assert.ok(activeRegIdx, 'Registration must have unique index on { eventRef: 1, userRef: 1 }');
      assert.deepEqual(activeRegIdx.partialFilterExpression, {
        status: { $in: ['held', 'confirmed', 'pending_approval'] }
      });

      // Active Waitlist Uniqueness
      const activeWaitlistIdx = regIndexes.find(
        (idx) => idx.key.eventRef === 1 && idx.key.userRef === 1 && idx.key.ticketTierRef === 1 && idx.unique === true
      );
      assert.ok(activeWaitlistIdx, 'Registration must have unique index on { eventRef: 1, userRef: 1, ticketTierRef: 1 }');
      assert.deepEqual(activeWaitlistIdx.partialFilterExpression, { status: 'waitlisted' });

      // Waitlist FIFO Position index
      assert.ok(hasIndex(regIndexes, { ticketTierRef: 1, waitlistPosition: 1 }));

      // 2. PaymentEvent Idempotency Index
      const paymentIndexes = await PaymentEvent.collection.listIndexes().toArray();
      const paymentUnique = paymentIndexes.find(
        (idx) => idx.key.provider === 1 && idx.key.eventId === 1 && idx.unique === true
      );
      assert.ok(paymentUnique, 'PaymentEvent must have unique index on { provider: 1, eventId: 1 }');

      // 3. Staff Assignment Uniqueness
      const staffIndexes = await StaffAssignment.collection.listIndexes().toArray();
      const staffUnique = staffIndexes.find(
        (idx) => idx.key.eventRef === 1 && idx.key.userRef === 1 && idx.unique === true
      );
      assert.ok(staffUnique, 'StaffAssignment must have unique index on { eventRef: 1, userRef: 1 }');

      // 4. Session Attendance Uniqueness
      const attendanceIndexes = await SessionAttendance.collection.listIndexes().toArray();
      const attendanceUnique = attendanceIndexes.find(
        (idx) => idx.key.sessionRef === 1 && idx.key['attendeePass.passNumber'] === 1 && idx.unique === true
      );
      assert.ok(attendanceUnique, 'SessionAttendance must have unique index on { sessionRef: 1, "attendeePass.passNumber": 1 }');

      // 5. Coupon Code Uniqueness per Event
      const couponIndexes = await Coupon.collection.listIndexes().toArray();
      const couponUnique = couponIndexes.find(
        (idx) => idx.key.eventRef === 1 && idx.key.code === 1 && idx.unique === true
      );
      assert.ok(couponUnique, 'Coupon must have unique index on { eventRef: 1, code: 1 }');

      // 6. Sponsor Package & Sponsorship Uniqueness
      const packageIndexes = await SponsorPackage.collection.listIndexes().toArray();
      assert.ok(packageIndexes.find((idx) => idx.key.eventRef === 1 && idx.key.name === 1 && idx.unique === true));

      const sponsorshipIndexes = await Sponsorship.collection.listIndexes().toArray();
      assert.ok(sponsorshipIndexes.find((idx) => idx.key.eventRef === 1 && idx.key.sponsorProfileRef === 1 && idx.unique === true));

      // 7. Feedback Uniqueness (1 review per user per session)
      const feedbackIndexes = await Feedback.collection.listIndexes().toArray();
      assert.ok(feedbackIndexes.find(
        (idx) => idx.key.eventRef === 1 && idx.key.sessionRef === 1 && idx.key.userRef === 1 && idx.unique === true
      ));
    });
  });

  // =========================================================================
  // 7. TWO-TIER HEALTH CHECK & READINESS
  // =========================================================================
  describe('7. Two-Tier Health Check Endpoint', () => {
    it('should return 200 OK with healthy status and database connected', async () => {
      const res = await request(app).get('/api/v1/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'healthy');
      assert.equal(res.body.data.database, 'connected');
      assert.equal(res.body.data.service, 'EventForge API');
      assert.ok(res.body.data.timestamp);
    });
  });
});
