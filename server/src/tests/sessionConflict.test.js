import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Venue from '../models/Venue.js';
import Event from '../models/Event.js';
import Session from '../models/Session.js';
import SpeakerProfile from '../models/SpeakerProfile.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventforge_test_suite';

describe('Phase 2 — Session Scheduling & Conflict Detection Engine Test Suite', () => {
  let organizerUser;
  let organizerToken;
  let org;
  let venue;
  let roomA;
  let roomB;
  let eventA;
  let eventB;
  let speaker1;
  let speaker2;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Session.deleteMany({});
      await SpeakerProfile.deleteMany({});
      await Event.deleteMany({});
      await Venue.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await Session.deleteMany({});
    await SpeakerProfile.deleteMany({});
    await Event.deleteMany({});
    await Venue.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    // 1. Organizer
    organizerUser = await User.create({
      name: 'Session Lead',
      email: 'session.lead@conf.org',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    organizerToken = signToken({ id: organizerUser._id.toString(), globalRole: 'user', email: organizerUser.email });

    // 2. Organization
    org = await Organization.create({
      name: 'ConfOrg',
      slug: 'conforg',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    // 3. Venue with two rooms
    venue = await Venue.create({
      name: 'Metropolitan Hall',
      organizationRef: org._id,
      address: { street: '1 Main', city: 'Seattle', country: 'USA' },
      capacity: 1000,
      rooms: [
        { name: 'Room Alpha', capacity: 200 },
        { name: 'Room Beta', capacity: 150 }
      ]
    });
    roomA = venue.rooms[0];
    roomB = venue.rooms[1];

    // 4. Two separate events
    eventA = await Event.create({
      title: 'Event Alpha',
      slug: 'event-alpha',
      organizationRef: org._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'published',
      description: 'Alpha Conf',
      startDate: new Date('2026-10-15T08:00:00Z'),
      endDate: new Date('2026-10-16T18:00:00Z'),
      venueRef: venue._id,
      totalCapacity: 500
    });

    eventB = await Event.create({
      title: 'Event Beta',
      slug: 'event-beta',
      organizationRef: org._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'published',
      description: 'Beta Conf',
      startDate: new Date('2026-10-15T08:00:00Z'),
      endDate: new Date('2026-10-16T18:00:00Z'),
      venueRef: venue._id,
      totalCapacity: 300
    });

    // 5. Speakers
    speaker1 = await SpeakerProfile.create({
      eventRef: eventA._id,
      fullName: 'Dr. Ada Lovelace',
      headline: 'Computing Pioneer',
      bio: 'Visionary computer scientist and mathematician.',
      topics: ['algorithms', 'architecture']
    });

    speaker2 = await SpeakerProfile.create({
      eventRef: eventA._id,
      fullName: 'Alan Turing',
      headline: 'Father of Modern Computing',
      bio: 'Mathematician, computer scientist, logician.',
      topics: ['cryptography', 'ai']
    });
  });

  // ==========================================
  // ROOM CONFLICT TESTS
  // ==========================================
  describe('Room Conflict Detection', () => {
    it('should schedule the initial session (10:00–11:00) without issue (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: eventA._id.toString(),
          title: 'Opening Keynote',
          roomId: roomA._id.toString(),
          startTime: '2026-10-15T10:00:00Z',
          endTime: '2026-10-15T11:00:00Z',
          capacityLimit: 200,
          speakerRefs: [speaker1._id.toString()]
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.session.title, 'Opening Keynote');
    });

    it('Scenario 1: 10:00–11:00 vs 10:30–11:30 in same room → CONFLICT (409 Conflict)', async () => {
      // 1. Initial Session: 10:00-11:00
      await Session.create({
        eventRef: eventA._id,
        title: 'Session 1',
        roomId: roomA._id,
        roomName: roomA.name,
        startTime: new Date('2026-10-15T10:00:00Z'),
        endTime: new Date('2026-10-15T11:00:00Z'),
        capacityLimit: 200
      });

      // 2. Overlapping Session: 10:30-11:30 in same room
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: eventA._id.toString(),
          title: 'Conflicting Session',
          roomId: roomA._id.toString(),
          startTime: '2026-10-15T10:30:00Z',
          endTime: '2026-10-15T11:30:00Z',
          capacityLimit: 150
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'SESSION_SCHEDULE_CONFLICT');
      assert.equal(res.body.error.details.conflictType, 'ROOM_CONFLICT');
    });

    it('Scenario 2: 10:00–11:00 vs 11:00–12:00 in same room → NO CONFLICT (201 Created)', async () => {
      // 1. Initial Session: 10:00-11:00
      await Session.create({
        eventRef: eventA._id,
        title: 'Session 1',
        roomId: roomA._id,
        roomName: roomA.name,
        startTime: new Date('2026-10-15T10:00:00Z'),
        endTime: new Date('2026-10-15T11:00:00Z'),
        capacityLimit: 200
      });

      // 2. Contiguous Session: starts exactly when Session 1 ends (11:00-12:00)
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: eventA._id.toString(),
          title: 'Back-to-Back Session',
          roomId: roomA._id.toString(),
          startTime: '2026-10-15T11:00:00Z',
          endTime: '2026-10-15T12:00:00Z',
          capacityLimit: 200
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.session.title, 'Back-to-Back Session');
    });

    it('Scenario 3: 10:00–12:00 vs 11:00–13:00 in same room → CONFLICT (409 Conflict)', async () => {
      // 1. Initial Session: 10:00-12:00
      await Session.create({
        eventRef: eventA._id,
        title: 'Long Workshop',
        roomId: roomA._id,
        roomName: roomA.name,
        startTime: new Date('2026-10-15T10:00:00Z'),
        endTime: new Date('2026-10-15T12:00:00Z'),
        capacityLimit: 100
      });

      // 2. Overlapping Session: 11:00-13:00
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: eventA._id.toString(),
          title: 'Intruding Panel',
          roomId: roomA._id.toString(),
          startTime: '2026-10-15T11:00:00Z',
          endTime: '2026-10-15T13:00:00Z',
          capacityLimit: 100
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'SESSION_SCHEDULE_CONFLICT');
      assert.equal(res.body.error.details.conflictType, 'ROOM_CONFLICT');
    });

    it('Scenario 4: 10:00–12:00 vs 09:00–10:00 in same room → NO CONFLICT (201 Created)', async () => {
      // 1. Initial Session: 10:00-12:00
      await Session.create({
        eventRef: eventA._id,
        title: 'Afternoon Workshop',
        roomId: roomA._id,
        roomName: roomA.name,
        startTime: new Date('2026-10-15T10:00:00Z'),
        endTime: new Date('2026-10-15T12:00:00Z'),
        capacityLimit: 100
      });

      // 2. Preceding Session: 09:00-10:00 ends right when afternoon starts
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: eventA._id.toString(),
          title: 'Morning Breakfast Briefing',
          roomId: roomA._id.toString(),
          startTime: '2026-10-15T09:00:00Z',
          endTime: '2026-10-15T10:00:00Z',
          capacityLimit: 100
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });
  });

  // ==========================================
  // SELF-EXCLUSION & CROSS-EVENT ISOLATION
  // ==========================================
  describe('Self-Exclusion & Cross-Event Isolation', () => {
    it('Scenario 5: Update session details without changing time → NO SELF-CONFLICT (200 OK)', async () => {
      const existingSession = await Session.create({
        eventRef: eventA._id,
        title: 'Keynote Draft',
        roomId: roomA._id,
        roomName: roomA.name,
        startTime: new Date('2026-10-15T10:00:00Z'),
        endTime: new Date('2026-10-15T11:00:00Z'),
        capacityLimit: 150
      });

      // Updating title & description within same time interval must NOT conflict with itself
      const res = await request(app)
        .put(`/api/v1/sessions/${existingSession._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Final Polished Keynote',
          description: 'Updated abstract and objectives.'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.session.title, 'Final Polished Keynote');
    });

    it('Scenario 6: Same room + overlapping time in DIFFERENT events → NO CONFLICT (201 Created)', async () => {
      // Event A has Session in Room A (10:00-11:00)
      await Session.create({
        eventRef: eventA._id,
        title: 'Event A Session',
        roomId: roomA._id,
        roomName: roomA.name,
        startTime: new Date('2026-10-15T10:00:00Z'),
        endTime: new Date('2026-10-15T11:00:00Z'),
        capacityLimit: 100
      });

      // Event B scheduling a session in the same room at the same time is isolated to Event B
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: eventB._id.toString(),
          title: 'Event B Session',
          roomId: roomA._id.toString(),
          startTime: '2026-10-15T10:00:00Z',
          endTime: '2026-10-15T11:00:00Z',
          capacityLimit: 100
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.session.title, 'Event B Session');
    });
  });

  // ==========================================
  // SPEAKER CONFLICT TESTS
  // ==========================================
  describe('Speaker Conflict Detection', () => {
    it('Scenario 7: Same speaker assigned to two overlapping sessions in different rooms → CONFLICT (409 Conflict)', async () => {
      // Session 1: Room Alpha with Speaker 1 (14:00-15:00)
      await Session.create({
        eventRef: eventA._id,
        title: 'Quantum Algorithms',
        roomId: roomA._id,
        roomName: roomA.name,
        startTime: new Date('2026-10-15T14:00:00Z'),
        endTime: new Date('2026-10-15T15:00:00Z'),
        capacityLimit: 100,
        speakerRefs: [speaker1._id]
      });

      // Session 2: Room Beta (different room!) with Speaker 1 at (14:30-15:30)
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: eventA._id.toString(),
          title: 'Advanced Cryptography Panel',
          roomId: roomB._id.toString(), // Room Beta is physically empty!
          startTime: '2026-10-15T14:30:00Z',
          endTime: '2026-10-15T15:30:00Z',
          capacityLimit: 100,
          speakerRefs: [speaker1._id.toString()] // Speaker 1 is already in Room Alpha!
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'SESSION_SCHEDULE_CONFLICT');
      assert.equal(res.body.error.details.conflictType, 'SPEAKER_CONFLICT');
    });

    it('should reject session creation if speaker does not belong to the event (400 Bad Request)', async () => {
      // Create speaker in Event B
      const speakerInEventB = await SpeakerProfile.create({
        eventRef: eventB._id,
        fullName: 'Outsider Speaker',
        bio: 'Visiting speaker assigned to Event B.'
      });

      // Try assigning Event B speaker to Event A session
      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: eventA._id.toString(),
          title: 'Cross-Event Speaker Test',
          roomId: roomA._id.toString(),
          startTime: '2026-10-15T16:00:00Z',
          endTime: '2026-10-15T17:00:00Z',
          capacityLimit: 100,
          speakerRefs: [speakerInEventB._id.toString()]
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_SPEAKER_ASSIGNMENT');
    });
  });

  // ==========================================
  // SPEAKER CRUD TESTS
  // ==========================================
  describe('Speaker Profile CRUD', () => {
    it('should create a speaker profile for an event (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/speakers')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          eventRef: eventA._id.toString(),
          fullName: 'Grace Hopper',
          headline: 'Rear Admiral & Pioneer',
          bio: 'Compiler pioneer and programming language developer.',
          topics: ['compilers', 'systems']
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.speaker.fullName, 'Grace Hopper');
    });

    it('should list all speakers for an event (200 OK)', async () => {
      const res = await request(app).get(`/api/v1/speakers/event/${eventA._id}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.speakers.length, 2);
    });

    it('should update a speaker profile (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/speakers/${speaker1._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          headline: 'Updated Computing Pioneer & Author'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.speaker.headline, 'Updated Computing Pioneer & Author');
    });

    it('should delete an unassigned speaker profile (200 OK)', async () => {
      const res = await request(app)
        .delete(`/api/v1/speakers/${speaker2._id}`)
        .set('Authorization', `Bearer ${organizerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const check = await SpeakerProfile.findById(speaker2._id);
      assert.equal(check, null);
    });
  });
});
