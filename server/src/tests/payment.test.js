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
import PaymentEvent from '../models/PaymentEvent.js';
import { TicketInventoryEngine } from '../services/ticketInventoryEngine.js';
import { MockPaymentProvider } from '../integrations/payment/mockPaymentProvider.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventforge_test_suite?directConnection=true';

describe('Phase 3 — Payment Ingestion & Webhook Idempotency Test Suite', () => {
  let organizerUser;
  let attendeeUser;
  let attendeeToken;
  let testOrg;
  let testEvent;
  let testTier;
  let heldReg;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await PaymentEvent.deleteMany({});
      await Registration.deleteMany({});
      await TicketTier.deleteMany({});
      await Event.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await PaymentEvent.deleteMany({});
    await Registration.deleteMany({});
    await TicketTier.deleteMany({});
    await Event.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    organizerUser = await User.create({
      name: 'Organizer',
      email: 'org@paymenttest.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });

    attendeeUser = await User.create({
      name: 'Alice Attendee',
      email: 'alice@paymenttest.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    attendeeToken = signToken({ id: attendeeUser._id.toString(), globalRole: 'user', email: attendeeUser.email });

    testOrg = await Organization.create({
      name: 'PayOrg',
      slug: 'payorg',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    testEvent = await Event.create({
      title: 'PayConf 2026',
      slug: 'payconf-2026',
      organizationRef: testOrg._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'published',
      description: 'Conference with payments.',
      startDate: new Date(Date.now() + 10 * 86400000),
      endDate: new Date(Date.now() + 12 * 86400000),
      totalCapacity: 200
    });

    testTier = await TicketTier.create({
      eventRef: testEvent._id,
      name: 'Standard Ticket',
      price: 120,
      totalQuantity: 50,
      salesStart: new Date(Date.now() - 86400000),
      salesEnd: new Date(Date.now() + 86400000),
      maxPerOrder: 3
    });

    const holdResult = await TicketInventoryEngine.holdTicket({
      eventId: testEvent._id,
      userId: attendeeUser._id,
      ticketTierId: testTier._id,
      quantity: 1,
      attendeeDetails: { firstName: 'Alice', lastName: 'Attendee', email: 'alice@paymenttest.com' }
    });
    heldReg = holdResult.registration;
  });

  // ==========================================
  // PAYMENT INTENT CREATION
  // ==========================================
  describe('Payment Intent Creation', () => {
    it('should create a payment intent for a held registration (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/create-intent')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          registrationId: heldReg._id.toString()
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.paymentIntent.id.startsWith('pi_mock_'));
      assert.equal(res.body.data.paymentIntent.amount, 120);

      const checkReg = await Registration.findById(heldReg._id);
      assert.equal(checkReg.paymentIntentId, res.body.data.paymentIntent.id);
    });

    it('should reject payment intent if registration is expired (410 Gone)', async () => {
      await Registration.findByIdAndUpdate(heldReg._id, {
        holdExpiresAt: new Date(Date.now() - 1000)
      });

      const res = await request(app)
        .post('/api/v1/payments/create-intent')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          registrationId: heldReg._id.toString()
        });

      assert.equal(res.status, 410);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'TICKET_HOLD_EXPIRED');
    });
  });

  // ==========================================
  // WEBHOOK SIGNATURE VERIFICATION
  // ==========================================
  describe('Webhook Security & Verification', () => {
    it('should reject webhook requests without a signature (400 Bad Request)', async () => {
      const payload = JSON.stringify({ id: 'evt_nosig_1', type: 'payment_intent.succeeded' });

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'PAYMENT_SIGNATURE_INVALID');
    });

    it('should reject webhook requests with an invalid forged signature (400 Bad Request)', async () => {
      const payload = JSON.stringify({ id: 'evt_forged_1', type: 'payment_intent.succeeded' });

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-mock-signature', 't=123,v1=invalid_signature_hash')
        .send(payload);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'PAYMENT_SIGNATURE_INVALID');
    });
  });

  // ==========================================
  // WEBHOOK INGESTION & IDEMPOTENCY
  // ==========================================
  describe('Webhook Ingestion & Idempotency', () => {
    it('should confirm registration and adjust inventory upon valid payment_intent.succeeded', async () => {
      const payload = {
        id: 'evt_success_100',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_mock_succ_100',
            amount: 120,
            metadata: { registrationId: heldReg._id.toString() }
          }
        }
      };

      const rawBody = JSON.stringify(payload);
      const signature = MockPaymentProvider.generateSignature(rawBody);

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-mock-signature', signature)
        .send(rawBody);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'processed');

      // Verify registration state
      const confirmedReg = await Registration.findById(heldReg._id);
      assert.equal(confirmedReg.status, 'confirmed');
      assert.equal(confirmedReg.paymentStatus, 'paid');
      assert.ok(confirmedReg.attendeePasses[0].qrCodePayload.startsWith('EFB1.'));

      // Verify inventory state: soldQuantity = 1, reservedQuantity = 0
      const tier = await TicketTier.findById(testTier._id);
      assert.equal(tier.soldQuantity, 1);
      assert.equal(tier.reservedQuantity, 0);

      // Verify PaymentEvent created
      const eventDoc = await PaymentEvent.findOne({ eventId: 'evt_success_100' });
      assert.ok(eventDoc);
      assert.equal(eventDoc.status, 'processed');
    });

    it('Scenario: Duplicate webhook delivery -> harmlessly ignored without double-crediting inventory', async () => {
      const payload = {
        id: 'evt_duplicate_test_200',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_mock_dup_200',
            amount: 120,
            metadata: { registrationId: heldReg._id.toString() }
          }
        }
      };

      const rawBody = JSON.stringify(payload);
      const signature = MockPaymentProvider.generateSignature(rawBody);

      // 1. First delivery
      const res1 = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-mock-signature', signature)
        .send(rawBody);
      assert.equal(res1.status, 200);
      assert.equal(res1.body.data.status, 'processed');

      // 2. Duplicate delivery
      const res2 = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-mock-signature', signature)
        .send(rawBody);

      assert.equal(res2.status, 200);
      assert.equal(res2.body.data.status, 'duplicate_ignored');

      // Invariant: soldQuantity must still be 1 (never double incremented)
      const tier = await TicketTier.findById(testTier._id);
      assert.equal(tier.soldQuantity, 1);
      assert.equal(tier.reservedQuantity, 0);

      // Invariant: exactly 1 PaymentEvent in DB
      const count = await PaymentEvent.countDocuments({ eventId: 'evt_duplicate_test_200' });
      assert.equal(count, 1);
    });
  });

  // ==========================================
  // CLIENT PAYMENT VERIFY ENDPOINT
  // ==========================================
  describe('Client Payment Verification', () => {
    it('should verify payment with provider and confirm registration (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          registrationId: heldReg._id.toString(),
          paymentIntentId: 'pi_mock_client_verify'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.registration.status, 'confirmed');
      assert.equal(res.body.data.registration.paymentStatus, 'paid');
    });
  });
});
