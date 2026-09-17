import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Event from '../models/Event.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventforge_test_suite';

describe('Phase 5 — AI Generative Services Test Suite', () => {
  let organizerUser;
  let organizerToken;
  let outsiderUser;
  let outsiderToken;
  let organization;
  let event;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Event.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await Event.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    organizerUser = await User.create({
      name: 'Event Curator',
      email: 'curator@summit.org',
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
      name: 'NextGen Tech',
      slug: 'nextgen-tech',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    event = await Event.create({
      title: 'Global Tech Expo 2026',
      slug: 'global-tech-expo-2026',
      organizationRef: organization._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'published',
      description: 'The premier annual gathering of technologists, innovators, and leaders.',
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 172800000),
      totalCapacity: 1000
    });
  });

  describe('Event Copy Generation', () => {
    it('should generate structured event marketing copy matching schema (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/ai/generate-event-copy')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          topic: 'Artificial Intelligence and Distributed Systems',
          eventType: 'conference',
          targetAudience: 'Senior Architects and ML Engineers',
          theme: 'Autonomous Infrastructure',
          keyPoints: ['Scalability', 'Fault tolerance', 'Local models']
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.title);
      assert.ok(res.body.data.description);
      assert.ok(res.body.data.executiveSummary);
      assert.ok(Array.isArray(res.body.data.suggestedTags));
      assert.ok(res.body.data.suggestedTags.length > 0);
    });

    it('should reject invalid event copy payload with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/ai/generate-event-copy')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          topic: 'AB' // min is 3
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  describe('Speaker Bio Generation', () => {
    it('should synthesize rough notes into a polished speaker bio (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/ai/generate-speaker-bio')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          speakerName: 'Dr. Evelyn Vance',
          rawNotes: '15 years at Bell Labs. Authored Raft optimization papers. Keynote speaker on distributed consensus.',
          professionalTitle: 'Principal Research Scientist',
          organization: 'Apex Computing',
          targetEventTopic: 'Distributed Systems'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.shortBio);
      assert.ok(res.body.data.fullBio);
      assert.ok(Array.isArray(res.body.data.keyTopics));
      assert.ok(res.body.data.socialHeadline);
    });
  });

  describe('Announcement Generation', () => {
    it('should generate targeted multi-channel announcement (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/ai/generate-announcement')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventId: event._id.toString(),
          announcementType: 'schedule_update',
          keyMessage: 'Keynote has been moved to Hall A at 10:30 AM due to high attendance.',
          targetAudience: 'all_attendees',
          urgency: 'high'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.title);
      assert.ok(res.body.data.emailSubject);
      assert.ok(res.body.data.content);
      assert.ok(res.body.data.smsSummary);
      assert.ok(Array.isArray(res.body.data.recommendedChannels));
    });

    it('should forbid outsider from generating announcements for an event they do not manage (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/ai/generate-announcement')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          eventId: event._id.toString(),
          announcementType: 'emergency',
          keyMessage: 'Unauthorized broadcast message.',
          targetAudience: 'all_attendees'
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });
  });

  describe('Error Simulation, Schema Guard & External Failure Mapping', () => {
    it('should handle simulated provider timeout with 504 Gateway Timeout', async () => {
      const res = await request(app)
        .post('/api/v1/ai/generate-event-copy')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          topic: 'Quantum Computing Frontiers',
          simulatedError: 'timeout'
        });

      assert.equal(res.status, 504);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'AI_TIMEOUT');
    });

    it('should handle simulated provider rate limit with 429 Too Many Requests', async () => {
      const res = await request(app)
        .post('/api/v1/ai/generate-event-copy')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          topic: 'Quantum Computing Frontiers',
          simulatedError: 'rate_limit'
        });

      assert.equal(res.status, 429);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'AI_RATE_LIMIT');
    });

    it('should handle simulated provider unavailability with 503 Service Unavailable', async () => {
      const res = await request(app)
        .post('/api/v1/ai/generate-event-copy')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          topic: 'Quantum Computing Frontiers',
          simulatedError: 'service_unavailable'
        });

      assert.equal(res.status, 503);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'AI_SERVICE_UNAVAILABLE');
    });

    it('should catch malformed provider output and reject with 502 Bad Gateway', async () => {
      const res = await request(app)
        .post('/api/v1/ai/generate-event-copy')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          topic: 'Quantum Computing Frontiers',
          simulatedError: 'malformed_json'
        });

      assert.equal(res.status, 502);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'AI_MALFORMED_OUTPUT');
    });

    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/ai/generate-event-copy')
        .send({
          topic: 'Quantum Computing Frontiers'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });
});
