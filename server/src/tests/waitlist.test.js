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
import { WaitlistService } from '../services/waitlistService.js';
import { expireTicketHoldsJob } from '../jobs/expireTicketHolds.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventforge_test_suite?directConnection=true';

describe('Phase 3 — Waitlist Lifecycle & FIFO Promotion Test Suite', () => {
  let organizerUser;
  let organizerToken;
  let userA;
  let tokenA;
  let userB;
  let tokenB;
  let testOrg;
  let testEvent;
  let soldOutTier;

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

    organizerUser = await User.create({
      name: 'Organizer',
      email: 'org@waitlisttest.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    organizerToken = signToken({ id: organizerUser._id.toString(), globalRole: 'user', email: organizerUser.email });

    userA = await User.create({
      name: 'Alice Waitlist',
      email: 'alice@waitlisttest.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    tokenA = signToken({ id: userA._id.toString(), globalRole: 'user', email: userA.email });

    userB = await User.create({
      name: 'Bob Waitlist',
      email: 'bob@waitlisttest.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    tokenB = signToken({ id: userB._id.toString(), globalRole: 'user', email: userB.email });

    testOrg = await Organization.create({
      name: 'WLOrg',
      slug: 'wlorg',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    testEvent = await Event.create({
      title: 'WL Conference 2026',
      slug: 'wl-conf-2026',
      organizationRef: testOrg._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'published',
      description: 'Waitlist testing conference.',
      startDate: new Date(Date.now() + 10 * 86400000),
      endDate: new Date(Date.now() + 12 * 86400000),
      totalCapacity: 100
    });

    // Tier with 1 seat, already sold out
    soldOutTier = await TicketTier.create({
      eventRef: testEvent._id,
      name: 'Sold Out Keynote',
      price: 100,
      totalQuantity: 1,
      soldQuantity: 1,
      reservedQuantity: 0,
      salesStart: new Date(Date.now() - 86400000),
      salesEnd: new Date(Date.now() + 86400000),
      maxPerOrder: 2
    });
  });

  // ==========================================
  // WAITLIST JOIN & FIFO ORDERING
  // ==========================================
  describe('Waitlist Queue Join & Ordering', () => {
    it('should assign sequential FIFO positions when users join waitlist (201 Created)', async () => {
      // 1. Alice joins
      const resA = await request(app)
        .post('/api/v1/registrations/waitlist')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          eventId: testEvent._id.toString(),
          ticketTierId: soldOutTier._id.toString(),
          quantity: 1,
          attendeeDetails: { firstName: 'Alice', lastName: 'WL', email: 'alice@waitlisttest.com' }
        });

      assert.equal(resA.status, 201);
      assert.equal(resA.body.data.registration.waitlistPosition, 1);
      assert.equal(resA.body.data.registration.status, 'waitlisted');

      // 2. Bob joins
      const resB = await request(app)
        .post('/api/v1/registrations/waitlist')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          eventId: testEvent._id.toString(),
          ticketTierId: soldOutTier._id.toString(),
          quantity: 1,
          attendeeDetails: { firstName: 'Bob', lastName: 'WL', email: 'bob@waitlisttest.com' }
        });

      assert.equal(resB.status, 201);
      assert.equal(resB.body.data.registration.waitlistPosition, 2);
    });

    it('should forbid joining waitlist if user already holds an active registration (409 Conflict)', async () => {
      // Alice already has confirmed registration
      await Registration.create({
        eventRef: testEvent._id,
        userRef: userA._id,
        ticketTierRef: soldOutTier._id,
        registrationNumber: 'EF-ACT-001',
        quantity: 1,
        status: 'confirmed',
        paymentStatus: 'paid',
        attendeeDetails: { firstName: 'Alice', lastName: 'WL', email: 'alice@waitlisttest.com' }
      });

      const res = await request(app)
        .post('/api/v1/registrations/waitlist')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          eventId: testEvent._id.toString(),
          ticketTierId: soldOutTier._id.toString(),
          quantity: 1,
          attendeeDetails: { firstName: 'Alice', lastName: 'WL', email: 'alice@waitlisttest.com' }
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_ACTIVE_REGISTRATION');
    });

    it('should allow user to leave waitlist (200 OK)', async () => {
      const reg = await Registration.create({
        eventRef: testEvent._id,
        userRef: userA._id,
        ticketTierRef: soldOutTier._id,
        registrationNumber: 'EF-WL-LEAVE',
        quantity: 1,
        status: 'waitlisted',
        waitlistPosition: 1,
        waitlistJoinedAt: new Date(),
        attendeeDetails: { firstName: 'Alice', lastName: 'WL', email: 'alice@waitlisttest.com' }
      });

      const res = await request(app)
        .delete(`/api/v1/registrations/waitlist/${reg._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const checkReg = await Registration.findById(reg._id);
      assert.equal(checkReg.status, 'cancelled');
      assert.equal(checkReg.waitlistPosition, null);
    });
  });

  // ==========================================
  // WAITLIST PROMOTION & INVENTORY RESERVATION
  // ==========================================
  describe('Waitlist Promotion Engine', () => {
    it('should promote oldest waitlisted user and atomically reserve inventory', async () => {
      // Alice is #1, Bob is #2
      const aliceReg = await Registration.create({
        eventRef: testEvent._id,
        userRef: userA._id,
        ticketTierRef: soldOutTier._id,
        registrationNumber: 'EF-WL-ALICE',
        quantity: 1,
        status: 'waitlisted',
        waitlistPosition: 1,
        waitlistJoinedAt: new Date(Date.now() - 5000),
        attendeeDetails: { firstName: 'Alice', lastName: 'WL', email: 'alice@waitlisttest.com' }
      });

      const bobReg = await Registration.create({
        eventRef: testEvent._id,
        userRef: userB._id,
        ticketTierRef: soldOutTier._id,
        registrationNumber: 'EF-WL-BOB',
        quantity: 1,
        status: 'waitlisted',
        waitlistPosition: 2,
        waitlistJoinedAt: new Date(Date.now() - 2000),
        attendeeDetails: { firstName: 'Bob', lastName: 'WL', email: 'bob@waitlisttest.com' }
      });

      // Release 1 ticket of inventory (soldQuantity 1 -> 0)
      await TicketTier.findByIdAndUpdate(soldOutTier._id, { soldQuantity: 0 });

      // Trigger promotion
      const promoted = await WaitlistService.promoteNextInQueue(soldOutTier._id);

      assert.ok(promoted);
      assert.equal(promoted._id.toString(), aliceReg._id.toString(), 'Oldest waitlisted user (Alice) must be promoted');
      assert.equal(promoted.status, 'held');
      assert.equal(promoted.holdType, 'waitlist_claim');
      assert.equal(promoted.waitlistPosition, null);

      // Verify 24 hour claim deadline
      const diffHours = (new Date(promoted.holdExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
      assert.ok(diffHours > 23.9 && diffHours <= 24);

      // CRITICAL: Inventory must be reserved for the claim
      const updatedTier = await TicketTier.findById(soldOutTier._id);
      assert.equal(updatedTier.reservedQuantity, 1);
      assert.equal(updatedTier.soldQuantity, 0);
      assert.equal(updatedTier.availableQuantity, 0);

      // Bob should still be in waitlist
      const checkBob = await Registration.findById(bobReg._id);
      assert.equal(checkBob.status, 'waitlisted');
    });

    it('Waitlist claim expiration releases inventory and promotes the next user', async () => {
      // Alice was promoted with a claim that just expired
      const aliceClaim = await Registration.create({
        eventRef: testEvent._id,
        userRef: userA._id,
        ticketTierRef: soldOutTier._id,
        registrationNumber: 'EF-CLAIM-ALICE',
        quantity: 1,
        status: 'held',
        holdType: 'waitlist_claim',
        paymentStatus: 'pending',
        holdExpiresAt: new Date(Date.now() - 5000), // Expired!
        attendeeDetails: { firstName: 'Alice', lastName: 'WL', email: 'alice@waitlisttest.com' }
      });

      // Bob is next in waitlist
      const bobReg = await Registration.create({
        eventRef: testEvent._id,
        userRef: userB._id,
        ticketTierRef: soldOutTier._id,
        registrationNumber: 'EF-WL-BOB2',
        quantity: 1,
        status: 'waitlisted',
        waitlistPosition: 1,
        waitlistJoinedAt: new Date(Date.now() - 3000),
        attendeeDetails: { firstName: 'Bob', lastName: 'WL', email: 'bob@waitlisttest.com' }
      });

      // Current tier: 1 seat reserved by Alice's claim
      await TicketTier.findByIdAndUpdate(soldOutTier._id, {
        soldQuantity: 0,
        reservedQuantity: 1
      });

      // Run expiration worker
      await expireTicketHoldsJob();

      // 1. Alice's claim must be expired
      const updatedAlice = await Registration.findById(aliceClaim._id);
      assert.equal(updatedAlice.status, 'expired');

      // 2. Bob must be promoted!
      const updatedBob = await Registration.findById(bobReg._id);
      assert.equal(updatedBob.status, 'held');
      assert.equal(updatedBob.holdType, 'waitlist_claim');

      // 3. Tier reservedQuantity must still be 1 (released by Alice, claimed by Bob)
      const updatedTier = await TicketTier.findById(soldOutTier._id);
      assert.equal(updatedTier.reservedQuantity, 1);
      assert.equal(updatedTier.soldQuantity, 0);
    });
  });
});
