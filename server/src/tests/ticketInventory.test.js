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
import { TicketInventoryEngine } from '../services/ticketInventoryEngine.js';
import { expireTicketHoldsJob } from '../jobs/expireTicketHolds.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventforge_test_suite?directConnection=true';

describe('Phase 3 — Ticket Inventory & Checkout Holds Test Suite', () => {
  let organizerUser;
  let organizerToken;
  let attendeeUser;
  let attendeeToken;
  let testOrg;
  let testEvent;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Registration.deleteMany({});
      await TicketTier.deleteMany({});
      await Event.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await Registration.deleteMany({});
    await TicketTier.deleteMany({});
    await Event.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    // 1. Create Organizer
    organizerUser = await User.create({
      name: 'Event Organizer',
      email: 'organizer@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    organizerToken = signToken({ id: organizerUser._id.toString(), globalRole: 'user', email: organizerUser.email });

    // 2. Create Attendee
    attendeeUser = await User.create({
      name: 'Jane Doe',
      email: 'jane@attendee.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    attendeeToken = signToken({ id: attendeeUser._id.toString(), globalRole: 'user', email: attendeeUser.email });

    // 3. Create Org & Event
    testOrg = await Organization.create({
      name: 'DevCon Global',
      slug: 'devcon-global',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    testEvent = await Event.create({
      title: 'DevCon 2026',
      slug: 'devcon-2026',
      organizationRef: testOrg._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'published',
      description: 'The premier software developer conference.',
      startDate: new Date(Date.now() + 10 * 86400000),
      endDate: new Date(Date.now() + 12 * 86400000),
      totalCapacity: 500
    });
  });

  // ==========================================
  // FREE & PAID TICKET HOLD FLOWS
  // ==========================================
  describe('Ticket Hold Semantics', () => {
    it('should immediately confirm free ($0) tickets and mint badge payloads (201 Created)', async () => {
      const freeTier = await TicketTier.create({
        eventRef: testEvent._id,
        name: 'Community Pass',
        price: 0,
        totalQuantity: 100,
        salesStart: new Date(Date.now() - 86400000),
        salesEnd: new Date(Date.now() + 86400000),
        maxPerOrder: 2
      });

      const res = await request(app)
        .post('/api/v1/registrations/hold')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          eventId: testEvent._id.toString(),
          ticketTierId: freeTier._id.toString(),
          quantity: 2,
          attendeeDetails: {
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@attendee.com'
          }
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'confirmed');

      const reg = res.body.data.registration;
      assert.equal(reg.status, 'confirmed');
      assert.equal(reg.paymentStatus, 'free');
      assert.equal(reg.totalAmountPaid, 0);
      assert.equal(reg.quantity, 2);
      assert.equal(reg.attendeePasses.length, 2);
      assert.ok(reg.attendeePasses[0].qrCodePayload.startsWith('EFB1.'));

      // Check tier accounting: soldQuantity += 2, reservedQuantity === 0
      const updatedTier = await TicketTier.findById(freeTier._id);
      assert.equal(updatedTier.soldQuantity, 2);
      assert.equal(updatedTier.reservedQuantity, 0);
      assert.equal(updatedTier.availableQuantity, 98);
    });

    it('should hold paid tickets for 15 minutes in pending payment state (201 Created)', async () => {
      const paidTier = await TicketTier.create({
        eventRef: testEvent._id,
        name: 'Standard Pass',
        price: 150,
        totalQuantity: 50,
        salesStart: new Date(Date.now() - 86400000),
        salesEnd: new Date(Date.now() + 86400000),
        maxPerOrder: 3
      });

      const res = await request(app)
        .post('/api/v1/registrations/hold')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          eventId: testEvent._id.toString(),
          ticketTierId: paidTier._id.toString(),
          quantity: 2,
          attendeeDetails: {
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@attendee.com'
          }
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'held');

      const reg = res.body.data.registration;
      assert.equal(reg.status, 'held');
      assert.equal(reg.holdType, 'checkout');
      assert.equal(reg.paymentStatus, 'pending');
      assert.equal(reg.totalAmountPaid, 300);
      assert.equal(reg.attendeePasses[0].qrCodePayload, null); // Badges NOT minted yet

      // Check tier accounting: reservedQuantity += 2, soldQuantity === 0
      const updatedTier = await TicketTier.findById(paidTier._id);
      assert.equal(updatedTier.reservedQuantity, 2);
      assert.equal(updatedTier.soldQuantity, 0);
      assert.equal(updatedTier.availableQuantity, 48);
    });

    it('should reject quantity exceeding maxPerOrder (400 Bad Request)', async () => {
      const tier = await TicketTier.create({
        eventRef: testEvent._id,
        name: 'VIP Pass',
        price: 500,
        totalQuantity: 10,
        salesStart: new Date(Date.now() - 86400000),
        salesEnd: new Date(Date.now() + 86400000),
        maxPerOrder: 2
      });

      const res = await request(app)
        .post('/api/v1/registrations/hold')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          eventId: testEvent._id.toString(),
          ticketTierId: tier._id.toString(),
          quantity: 3,
          attendeeDetails: {
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@attendee.com'
          }
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  // ==========================================
  // ACTIVE REGISTRATION UNIQUENESS
  // ==========================================
  describe('Active Registration Uniqueness', () => {
    it('should prevent duplicate active registrations for the same user on the same event (409 Conflict)', async () => {
      const tier = await TicketTier.create({
        eventRef: testEvent._id,
        name: 'General Admission',
        price: 100,
        totalQuantity: 50,
        salesStart: new Date(Date.now() - 86400000),
        salesEnd: new Date(Date.now() + 86400000),
        maxPerOrder: 2
      });

      // 1. First hold succeeds
      const firstHold = await request(app)
        .post('/api/v1/registrations/hold')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          eventId: testEvent._id.toString(),
          ticketTierId: tier._id.toString(),
          quantity: 1,
          attendeeDetails: { firstName: 'Jane', lastName: 'Doe', email: 'jane@attendee.com' }
        });
      assert.equal(firstHold.status, 201);

      // 2. Second hold while first is still active -> rejected!
      const secondHold = await request(app)
        .post('/api/v1/registrations/hold')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          eventId: testEvent._id.toString(),
          ticketTierId: tier._id.toString(),
          quantity: 1,
          attendeeDetails: { firstName: 'Jane', lastName: 'Doe', email: 'jane@attendee.com' }
        });

      assert.equal(secondHold.status, 409);
      assert.equal(secondHold.body.error.code, 'DUPLICATE_ACTIVE_REGISTRATION');
    });

    it('should allow user to register after previous registration was cancelled or expired (201 Created)', async () => {
      const tier = await TicketTier.create({
        eventRef: testEvent._id,
        name: 'General Admission',
        price: 100,
        totalQuantity: 50,
        salesStart: new Date(Date.now() - 86400000),
        salesEnd: new Date(Date.now() + 86400000),
        maxPerOrder: 2
      });

      // Create expired historical registration
      await Registration.create({
        eventRef: testEvent._id,
        userRef: attendeeUser._id,
        ticketTierRef: tier._id,
        registrationNumber: 'EF-HIST-001',
        quantity: 1,
        status: 'expired',
        paymentStatus: 'failed',
        attendeeDetails: { firstName: 'Jane', lastName: 'Doe', email: 'jane@attendee.com' }
      });

      // New hold should succeed without conflict
      const res = await request(app)
        .post('/api/v1/registrations/hold')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          eventId: testEvent._id.toString(),
          ticketTierId: tier._id.toString(),
          quantity: 1,
          attendeeDetails: { firstName: 'Jane', lastName: 'Doe', email: 'jane@attendee.com' }
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });
  });

  // ==========================================
  // CONCURRENCY & OVERSELLING PREVENTION
  // ==========================================
  describe('Concurrency & Inventory Protection', () => {
    it('Scenario: totalQuantity = 1, 10 concurrent users compete -> EXACTLY 1 succeeds, 0 oversold', async () => {
      const singleSeatTier = await TicketTier.create({
        eventRef: testEvent._id,
        name: 'Last Solo Seat',
        price: 200,
        totalQuantity: 1,
        salesStart: new Date(Date.now() - 86400000),
        salesEnd: new Date(Date.now() + 86400000),
        maxPerOrder: 1
      });

      // Create 10 distinct users
      const users = [];
      for (let i = 0; i < 10; i++) {
        const u = await User.create({
          name: `Competitor ${i}`,
          email: `competitor_${i}@test.com`,
          passwordHash: 'Password123!',
          globalRole: 'user'
        });
        users.push(u);
      }

      // Launch 10 simultaneous holdTicket operations
      const results = await Promise.allSettled(
        users.map((u) =>
          TicketInventoryEngine.holdTicket({
            eventId: testEvent._id,
            userId: u._id,
            ticketTierId: singleSeatTier._id,
            quantity: 1,
            attendeeDetails: { firstName: u.name, lastName: 'Test', email: u.email }
          })
        )
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, 'Exactly one concurrent request must succeed');
      assert.equal(rejected.length, 9, 'Nine concurrent requests must be rejected');

      // Verify DB state
      const finalTier = await TicketTier.findById(singleSeatTier._id);
      assert.equal(finalTier.reservedQuantity, 1);
      assert.equal(finalTier.soldQuantity, 0);
      assert.equal(finalTier.availableQuantity, 0);

      const registrations = await Registration.find({ ticketTierRef: singleSeatTier._id });
      assert.equal(registrations.length, 1);
      assert.equal(registrations[0].status, 'held');
    });

    it('Scenario: totalQuantity = 10, requests totaling 20 tickets -> reservedQuantity <= 10', async () => {
      const limitedTier = await TicketTier.create({
        eventRef: testEvent._id,
        name: 'Limited Batch',
        price: 50,
        totalQuantity: 10,
        salesStart: new Date(Date.now() - 86400000),
        salesEnd: new Date(Date.now() + 86400000),
        maxPerOrder: 5
      });

      // 5 users requesting 4 tickets each (total 20 requested)
      const users = [];
      for (let i = 0; i < 5; i++) {
        const u = await User.create({
          name: `Buyer ${i}`,
          email: `buyer_${i}@test.com`,
          passwordHash: 'Password123!',
          globalRole: 'user'
        });
        users.push(u);
      }

      await Promise.allSettled(
        users.map((u) =>
          TicketInventoryEngine.holdTicket({
            eventId: testEvent._id,
            userId: u._id,
            ticketTierId: limitedTier._id,
            quantity: 4,
            attendeeDetails: { firstName: u.name, lastName: 'Buyer', email: u.email }
          })
        )
      );

      const finalTier = await TicketTier.findById(limitedTier._id);
      assert.ok(finalTier.reservedQuantity <= 10, 'Reserved quantity must never exceed totalQuantity');
      assert.ok(finalTier.soldQuantity + finalTier.reservedQuantity <= finalTier.totalQuantity);
    });
  });

  // ==========================================
  // PAYMENT VS EXPIRATION RACE
  // ==========================================
  describe('Payment Confirmation vs Hold Expiration Race', () => {
    it('Simultaneous confirmPayment and expireTicketHoldsJob -> EXACTLY ONE wins', async () => {
      const tier = await TicketTier.create({
        eventRef: testEvent._id,
        name: 'Race Pass',
        price: 100,
        totalQuantity: 5,
        soldQuantity: 0,
        reservedQuantity: 1,
        salesStart: new Date(Date.now() - 86400000),
        salesEnd: new Date(Date.now() + 86400000),
        maxPerOrder: 1
      });

      // Create a held registration that is right at expiration
      const heldReg = await Registration.create({
        eventRef: testEvent._id,
        userRef: attendeeUser._id,
        ticketTierRef: tier._id,
        registrationNumber: 'EF-RACE-001',
        quantity: 1,
        status: 'held',
        holdType: 'checkout',
        paymentStatus: 'pending',
        holdExpiresAt: new Date(Date.now() - 100), // Expired by 100ms
        totalAmountPaid: 100,
        attendeeDetails: { firstName: 'Jane', lastName: 'Doe', email: 'jane@attendee.com' }
      });

      // Race confirmPayment vs expireTicketHoldsJob
      const raceResults = await Promise.allSettled([
        TicketInventoryEngine.confirmPayment({
          registrationId: heldReg._id,
          paymentIntentId: 'pi_mock_race_123'
        }),
        expireTicketHoldsJob()
      ]);

      const updatedReg = await Registration.findById(heldReg._id);
      const updatedTier = await TicketTier.findById(tier._id);

      assert.ok(
        updatedReg.status === 'confirmed' || updatedReg.status === 'expired',
        'Registration must end in confirmed or expired'
      );

      if (updatedReg.status === 'confirmed') {
        assert.equal(updatedTier.soldQuantity, 1);
        assert.equal(updatedTier.reservedQuantity, 0);
      } else {
        assert.equal(updatedTier.soldQuantity, 0);
        assert.equal(updatedTier.reservedQuantity, 0);
      }

      // Invariant: soldQuantity + reservedQuantity <= totalQuantity
      assert.ok(updatedTier.soldQuantity + updatedTier.reservedQuantity <= updatedTier.totalQuantity);
    });
  });
});
