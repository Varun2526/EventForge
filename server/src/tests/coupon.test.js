import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Event from '../models/Event.js';
import TicketTier from '../models/TicketTier.js';
import Coupon from '../models/Coupon.js';
import Registration from '../models/Registration.js';
import { TicketInventoryEngine } from '../services/ticketInventoryEngine.js';
import { expireTicketHoldsJob } from '../jobs/expireTicketHolds.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventforge_test_suite?directConnection=true';

describe('Phase 3 — Coupon Management & Concurrency Test Suite', () => {
  let organizerUser;
  let organizerToken;
  let attendeeUser;
  let attendeeToken;
  let testOrg;
  let testEvent;
  let testTier;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Registration.deleteMany({});
      await Coupon.deleteMany({});
      await TicketTier.deleteMany({});
      await Event.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await Registration.deleteMany({});
    await Coupon.deleteMany({});
    await TicketTier.deleteMany({});
    await Event.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    organizerUser = await User.create({
      name: 'Organizer',
      email: 'organizer@devcon.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    organizerToken = signToken({ id: organizerUser._id.toString(), globalRole: 'user', email: organizerUser.email });

    attendeeUser = await User.create({
      name: 'John Attendee',
      email: 'john@devcon.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    attendeeToken = signToken({ id: attendeeUser._id.toString(), globalRole: 'user', email: attendeeUser.email });

    testOrg = await Organization.create({
      name: 'DevOrg',
      slug: 'devorg',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    testEvent = await Event.create({
      title: 'DevConf 2026',
      slug: 'devconf-2026',
      organizationRef: testOrg._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'published',
      description: 'Annual conference.',
      startDate: new Date(Date.now() + 10 * 86400000),
      endDate: new Date(Date.now() + 12 * 86400000),
      totalCapacity: 300
    });

    testTier = await TicketTier.create({
      eventRef: testEvent._id,
      name: 'Standard Ticket',
      price: 100,
      totalQuantity: 100,
      salesStart: new Date(Date.now() - 86400000),
      salesEnd: new Date(Date.now() + 86400000),
      maxPerOrder: 4
    });
  });

  // ==========================================
  // COUPON VALIDATION & CREATION
  // ==========================================
  describe('Coupon Validation & Calculation', () => {
    it('should validate an active coupon (200 OK)', async () => {
      await Coupon.create({
        eventRef: testEvent._id,
        code: 'SAVE20',
        discountType: 'percentage',
        discountValue: 20,
        maxUses: 50,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: new Date(Date.now() + 86400000)
      });

      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .send({
          eventId: testEvent._id.toString(),
          code: 'save20'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.coupon.code, 'SAVE20');
      assert.equal(res.body.data.coupon.discountValue, 20);
    });

    it('should apply 20% discount on checkout hold (201 Created)', async () => {
      await Coupon.create({
        eventRef: testEvent._id,
        code: 'SAVE20',
        discountType: 'percentage',
        discountValue: 20,
        maxUses: 10,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: new Date(Date.now() + 86400000)
      });

      const res = await request(app)
        .post('/api/v1/registrations/hold')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          eventId: testEvent._id.toString(),
          ticketTierId: testTier._id.toString(),
          quantity: 2, // 2 * $100 = $200. With 20% off: $160
          couponCode: 'save20',
          attendeeDetails: { firstName: 'John', lastName: 'Attendee', email: 'john@devcon.com' }
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.registration.totalAmountPaid, 160);

      // Verify coupon reservedUses was incremented
      const coupon = await Coupon.findOne({ code: 'SAVE20' });
      assert.equal(coupon.reservedUses, 1);
      assert.equal(coupon.usedCount, 0);
    });

    it('should transition reservedUses to usedCount upon payment confirmation', async () => {
      const coupon = await Coupon.create({
        eventRef: testEvent._id,
        code: 'FLAT50',
        discountType: 'fixed_amount',
        discountValue: 50,
        maxUses: 10,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: new Date(Date.now() + 86400000)
      });

      const holdResult = await TicketInventoryEngine.holdTicket({
        eventId: testEvent._id,
        userId: attendeeUser._id,
        ticketTierId: testTier._id,
        quantity: 1,
        couponCode: 'FLAT50',
        attendeeDetails: { firstName: 'John', lastName: 'Attendee', email: 'john@devcon.com' }
      });

      // Confirm payment
      await TicketInventoryEngine.confirmPayment({
        registrationId: holdResult.registration._id,
        paymentIntentId: 'pi_mock_coupon_confirm'
      });

      const updatedCoupon = await Coupon.findById(coupon._id);
      assert.equal(updatedCoupon.reservedUses, 0);
      assert.equal(updatedCoupon.usedCount, 1);
    });

    it('should release reservedUses when a ticket hold expires', async () => {
      const coupon = await Coupon.create({
        eventRef: testEvent._id,
        code: 'RELEASEME',
        discountType: 'percentage',
        discountValue: 10,
        maxUses: 5,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: new Date(Date.now() + 86400000)
      });

      const holdResult = await TicketInventoryEngine.holdTicket({
        eventId: testEvent._id,
        userId: attendeeUser._id,
        ticketTierId: testTier._id,
        quantity: 1,
        couponCode: 'RELEASEME',
        attendeeDetails: { firstName: 'John', lastName: 'Attendee', email: 'john@devcon.com' }
      });

      let checkCoupon = await Coupon.findById(coupon._id);
      assert.equal(checkCoupon.reservedUses, 1);

      // Expire hold manually
      await Registration.findByIdAndUpdate(holdResult.registration._id, {
        holdExpiresAt: new Date(Date.now() - 1000)
      });

      await expireTicketHoldsJob();

      checkCoupon = await Coupon.findById(coupon._id);
      assert.equal(checkCoupon.reservedUses, 0);
      assert.equal(checkCoupon.usedCount, 0);
    });
  });

  // ==========================================
  // COUPON CONCURRENCY PROTECTION
  // ==========================================
  describe('Coupon Concurrency Protection', () => {
    it('Scenario: maxUses = 1, 5 concurrent checkouts -> at most 1 coupon reservation succeeds', async () => {
      const singleUseCoupon = await Coupon.create({
        eventRef: testEvent._id,
        code: 'ONLYONE',
        discountType: 'percentage',
        discountValue: 50,
        maxUses: 1,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: new Date(Date.now() + 86400000)
      });

      // 5 distinct users
      const users = [];
      for (let i = 0; i < 5; i++) {
        const u = await User.create({
          name: `Coupon User ${i}`,
          email: `coupon_user_${i}@devcon.com`,
          passwordHash: 'Password123!',
          globalRole: 'user'
        });
        users.push(u);
      }

      const results = await Promise.allSettled(
        users.map((u) =>
          TicketInventoryEngine.holdTicket({
            eventId: testEvent._id,
            userId: u._id,
            ticketTierId: testTier._id,
            quantity: 1,
            couponCode: 'ONLYONE',
            attendeeDetails: { firstName: u.name, lastName: 'Test', email: u.email }
          })
        )
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, 'Only 1 user may successfully claim the single-use coupon');
      assert.equal(rejected.length, 4, '4 users must be rejected with coupon exhausted');

      const finalCoupon = await Coupon.findById(singleUseCoupon._id);
      assert.equal(finalCoupon.reservedUses, 1);
      assert.equal(finalCoupon.usedCount, 0);
      assert.ok(finalCoupon.usedCount + finalCoupon.reservedUses <= finalCoupon.maxUses);
    });
  });
});
