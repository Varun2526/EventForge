import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Venue from '../models/Venue.js';
import Event from '../models/Event.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventforge_test_suite';

describe('Phase 2 — Event Catalog & Management Test Suite', () => {
  let organizerUser;
  let organizerToken;
  let outsiderUser;
  let outsiderToken;
  let orgA;
  let orgB;
  let venueA;
  let venueB;
  let sampleEvent;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Event.deleteMany({});
      await Venue.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await Event.deleteMany({});
    await Venue.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    // 1. Organizer in Org A
    organizerUser = await User.create({
      name: 'Event Organizer',
      email: 'organizer@summit.org',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    organizerToken = signToken({ id: organizerUser._id.toString(), globalRole: 'user', email: organizerUser.email });

    // 2. Outsider in Org B
    outsiderUser = await User.create({
      name: 'Outsider User',
      email: 'outsider@other.org',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    outsiderToken = signToken({ id: outsiderUser._id.toString(), globalRole: 'user', email: outsiderUser.email });

    // 3. Organizations
    orgA = await Organization.create({
      name: 'Summit Global',
      slug: 'summit-global',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    orgB = await Organization.create({
      name: 'Other Org',
      slug: 'other-org',
      ownerRef: outsiderUser._id,
      members: [{ userRef: outsiderUser._id, role: 'owner' }]
    });

    // 4. Venues
    venueA = await Venue.create({
      name: 'Grand Summit Hall',
      organizationRef: orgA._id,
      address: { street: '1 Summit Blvd', city: 'Denver', country: 'USA' },
      capacity: 2000,
      rooms: [{ name: 'Room 1', capacity: 500 }]
    });

    venueB = await Venue.create({
      name: 'Other Hall',
      organizationRef: orgB._id,
      address: { street: '2 Other Rd', city: 'Boulder', country: 'USA' },
      capacity: 500,
      rooms: [{ name: 'Room B1', capacity: 200 }]
    });

    // 5. Base Event
    sampleEvent = await Event.create({
      title: 'Global AI Summit 2026',
      slug: 'global-ai-summit-2026',
      organizationRef: orgA._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'draft',
      description: 'The premier enterprise AI summit.',
      startDate: new Date('2026-10-10T09:00:00Z'),
      endDate: new Date('2026-10-12T18:00:00Z'),
      venueRef: venueA._id,
      totalCapacity: 1500
    });
  });

  // ==========================================
  // EVENT CREATION & CROSS-ORG ISOLATION
  // ==========================================
  describe('POST /api/v1/events', () => {
    it('should create an event draft for an authorized organization owner (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Cloud Security Summit',
          organizationRef: orgA._id.toString(),
          type: 'conference',
          description: 'A deep dive into cloud security.',
          startDate: '2026-11-01T09:00:00Z',
          endDate: '2026-11-02T18:00:00Z',
          venueRef: venueA._id.toString(),
          totalCapacity: 800
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.event.status, 'draft');
      assert.equal(res.body.data.event.slug, 'cloud-security-summit');
      assert.equal(res.body.data.event.organizerRef, organizerUser._id.toString());
    });

    it('should reject event creation referencing a venue from another organization (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Unauthorized Venue Event',
          organizationRef: orgA._id.toString(),
          type: 'workshop',
          description: 'Testing cross-organization venue reference.',
          startDate: '2026-11-01T09:00:00Z',
          endDate: '2026-11-02T18:00:00Z',
          venueRef: venueB._id.toString(), // Venue belongs to orgB!
          totalCapacity: 200
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'CROSS_ORGANIZATION_RESOURCE');
    });

    it('should reject event creation if start date is after end date (400 Validation Error)', async () => {
      const res = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Time Travel Summit',
          organizationRef: orgA._id.toString(),
          type: 'workshop',
          description: 'Testing invalid date bounds.',
          startDate: '2026-11-05T09:00:00Z',
          endDate: '2026-11-01T09:00:00Z', // Inverted dates!
          totalCapacity: 200
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });
  });

  // ==========================================
  // EVENT ACCESS & LIFECYCLE
  // ==========================================
  describe('Event Lifecycle & RBAC', () => {
    it('should forbid unauthenticated or outsider users from viewing draft events (403/404)', async () => {
      // Unauthenticated request to draft event
      const publicRes = await request(app).get(`/api/v1/events/${sampleEvent._id}`);
      assert.equal(publicRes.status, 404);

      // Outsider user request to draft event
      const outsiderRes = await request(app)
        .get(`/api/v1/events/${sampleEvent._id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      assert.equal(outsiderRes.status, 403);
    });

    it('should allow organizer to update their own event (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/events/${sampleEvent._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Global AI Summit 2026 — Expanded',
          totalCapacity: 2500
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.event.totalCapacity, 2500);
    });

    it('should forbid non-organizer from updating an event (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/v1/events/${sampleEvent._id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          title: 'Hacked Event'
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should allow organizer to publish the event (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/v1/events/${sampleEvent._id}/publish`)
        .set('Authorization', `Bearer ${organizerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.event.status, 'published');

      // Now public should be able to view it
      const publicRes = await request(app).get(`/api/v1/events/${sampleEvent._id}`);
      assert.equal(publicRes.status, 200);
      assert.equal(publicRes.body.data.event.title, 'Global AI Summit 2026');
    });

    it('should allow organizer to cancel an event (200 OK)', async () => {
      const res = await request(app)
        .delete(`/api/v1/events/${sampleEvent._id}`)
        .set('Authorization', `Bearer ${organizerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const check = await Event.findById(sampleEvent._id);
      assert.equal(check.status, 'cancelled');
    });
  });
});
