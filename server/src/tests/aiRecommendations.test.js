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
import SessionAttendance from '../models/SessionAttendance.js';
import Registration from '../models/Registration.js';
import TicketTier from '../models/TicketTier.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventforge_test_suite';

describe('Phase 5 — AI Session Recommendation Engine Test Suite', () => {
  let attendeeUser;
  let attendeeToken;
  let organizerUser;
  let organization;
  let event;
  let venue;
  let ticketTier;
  let registration;
  let sessionAI1;
  let sessionAI2Conflict;
  let sessionCloud;
  let sessionDesign;
  let attendedSession;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await SessionAttendance.deleteMany({});
      await Registration.deleteMany({});
      await TicketTier.deleteMany({});
      await Session.deleteMany({});
      await Venue.deleteMany({});
      await Event.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await SessionAttendance.deleteMany({});
    await Registration.deleteMany({});
    await TicketTier.deleteMany({});
    await Session.deleteMany({});
    await Venue.deleteMany({});
    await Event.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    attendeeUser = await User.create({
      name: 'Alice Attendee',
      email: 'alice@attendee.com',
      passwordHash: 'Password123!',
      globalRole: 'user',
      interests: ['artificial intelligence', 'machine learning', 'cloud computing']
    });
    attendeeToken = signToken({
      id: attendeeUser._id.toString(),
      globalRole: attendeeUser.globalRole,
      email: attendeeUser.email
    });

    organizerUser = await User.create({
      name: 'Bob Organizer',
      email: 'bob@org.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });

    organization = await Organization.create({
      name: 'Summit Inc',
      slug: 'summit-inc',
      ownerRef: organizerUser._id
    });

    event = await Event.create({
      title: 'Tech Horizons 2026',
      slug: 'tech-horizons-2026',
      organizationRef: organization._id,
      organizerRef: organizerUser._id,
      type: 'conference',
      status: 'published',
      description: 'Future of Tech and Cloud Computing.',
      startDate: new Date('2026-10-10T09:00:00Z'),
      endDate: new Date('2026-10-10T18:00:00Z'),
      totalCapacity: 500
    });

    venue = await Venue.create({
      name: 'Convention Center',
      organizationRef: organization._id,
      address: { street: '100 Main St', city: 'Metro', country: 'US' },
      capacity: 500,
      rooms: [
        { name: 'Room Alpha', capacity: 100 },
        { name: 'Room Beta', capacity: 100 }
      ]
    });

    ticketTier = await TicketTier.create({
      eventRef: event._id,
      name: 'General Admission',
      price: 100,
      currency: 'USD',
      totalQuantity: 500,
      availableQuantity: 499,
      reservedQuantity: 0,
      soldQuantity: 1,
      salesStart: new Date(Date.now() - 86400000),
      salesEnd: new Date(Date.now() + 86400000)
    });

    registration = await Registration.create({
      eventRef: event._id,
      userRef: attendeeUser._id,
      ticketTierRef: ticketTier._id,
      registrationNumber: 'REG-TEST-RECOMMEND-001',
      status: 'confirmed',
      paymentStatus: 'paid',
      quantity: 1,
      baseAmount: 100,
      totalAmount: 100,
      discountAmount: 0,
      finalAmount: 100,
      attendeeDetails: {
        firstName: 'Alice',
        lastName: 'Attendee',
        email: 'alice@attendee.com'
      },
      attendeePasses: [
        {
          passNumber: 'PASS-TEST-1',
          holderName: 'Alice Attendee',
          holderEmail: 'alice@attendee.com',
          checkedIn: true,
          checkedInAt: new Date()
        }
      ]
    });

    // Session 1: 10:00 - 11:00 (AI track, highly relevant to Alice)
    sessionAI1 = await Session.create({
      eventRef: event._id,
      venueRef: venue._id,
      roomId: venue.rooms[0]._id,
      title: 'Deep Learning & Artificial Intelligence At Scale',
      description: 'Techniques for scaling neural networks in enterprise infrastructure.',
      roomName: 'Room Alpha',
      track: 'Artificial Intelligence',
      tags: ['artificial intelligence', 'machine learning', 'deep learning'],
      startTime: new Date('2026-10-10T10:00:00Z'),
      endTime: new Date('2026-10-10T11:00:00Z'),
      capacityLimit: 100,
      status: 'scheduled'
    });

    // Session 2: 10:30 - 11:30 (Overlaps with Session 1, also AI/ML, lower match or competing)
    sessionAI2Conflict = await Session.create({
      eventRef: event._id,
      venueRef: venue._id,
      roomId: venue.rooms[1]._id,
      title: 'Machine Learning Pipelines & Data Engineering',
      description: 'Building robust pipelines for models.',
      roomName: 'Room Beta',
      track: 'Data & Machine Learning',
      tags: ['machine learning', 'data'],
      startTime: new Date('2026-10-10T10:30:00Z'),
      endTime: new Date('2026-10-10T11:30:00Z'),
      capacityLimit: 100,
      status: 'scheduled'
    });

    // Session 3: 13:00 - 14:00 (Cloud track, non-conflicting, relevant)
    sessionCloud = await Session.create({
      eventRef: event._id,
      venueRef: venue._id,
      roomId: venue.rooms[0]._id,
      title: 'Cloud Computing Infrastructure Patterns',
      description: 'Distributed cloud architectures and resiliency.',
      roomName: 'Room Alpha',
      track: 'Cloud Computing',
      tags: ['cloud computing', 'distributed systems'],
      startTime: new Date('2026-10-10T13:00:00Z'),
      endTime: new Date('2026-10-10T14:00:00Z'),
      capacityLimit: 100,
      status: 'scheduled'
    });

    // Session 4: 15:00 - 16:00 (Design track, unrelated to Alice's profile)
    sessionDesign = await Session.create({
      eventRef: event._id,
      venueRef: venue._id,
      roomId: venue.rooms[0]._id,
      title: 'UI/UX Design Systems for Web Applications',
      description: 'Color tokens, typography, and accessibility.',
      roomName: 'Room Alpha',
      track: 'Design',
      tags: ['design', 'figma', 'ux'],
      startTime: new Date('2026-10-10T15:00:00Z'),
      endTime: new Date('2026-10-10T16:00:00Z'),
      capacityLimit: 100,
      status: 'scheduled'
    });

    // Session 5: 09:00 - 10:00 (Attended session)
    attendedSession = await Session.create({
      eventRef: event._id,
      venueRef: venue._id,
      roomId: venue.rooms[0]._id,
      title: 'Morning Keynote: Modern Tech Frontiers',
      description: 'Opening kickoff keynote.',
      roomName: 'Room Alpha',
      track: 'General',
      tags: ['keynote', 'frontiers'],
      startTime: new Date('2026-10-10T09:00:00Z'),
      endTime: new Date('2026-10-10T10:00:00Z'),
      capacityLimit: 100,
      status: 'scheduled'
    });

    // Mark attendedSession as attended by Alice
    await SessionAttendance.create({
      eventRef: event._id,
      sessionRef: attendedSession._id,
      registrationRef: registration._id,
      userRef: attendeeUser._id,
      attendeePass: {
        passNumber: 'PASS-TEST-1',
        holderName: 'Alice Attendee',
        holderEmail: 'alice@attendee.com'
      },
      scannedByStaffRef: organizerUser._id,
      checkInSource: 'kiosk',
      scannedAt: new Date('2026-10-10T09:05:00Z')
    });
  });

  it('should return personalized recommendations with Jaccard scores and explanations (200 OK)', async () => {
    const res = await request(app)
      .get(`/api/v1/ai/recommendations/${event._id}`)
      .set('Authorization', `Bearer ${attendeeToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;

    assert.equal(data.eventId, event._id.toString());
    assert.ok(data.recommendedItinerary.length > 0);

    // Verify sessionAI1 is in itinerary with high similarity score
    const ai1InItinerary = data.recommendedItinerary.find(
      (s) => s.sessionId === sessionAI1._id.toString()
    );
    assert.ok(ai1InItinerary, 'Top AI session should be in recommended itinerary');
    assert.ok(ai1InItinerary.similarityScore > 0, 'Should have positive similarity score');
    assert.ok(ai1InItinerary.explanation, 'Should have a factual explanation');
    assert.ok(
      ai1InItinerary.explanation.toLowerCase().includes('interest') ||
      ai1InItinerary.explanation.toLowerCase().includes('topic')
    );
  });

  it('should exclude sessions the attendee has already attended', async () => {
    const res = await request(app)
      .get(`/api/v1/ai/recommendations/${event._id}`)
      .set('Authorization', `Bearer ${attendeeToken}`);

    assert.equal(res.status, 200);
    const data = res.body.data;

    const allRecommendedIds = [
      ...data.recommendedItinerary.map((s) => s.sessionId),
      ...data.conflictingAlternatives.map((s) => s.sessionId)
    ];

    assert.equal(
      allRecommendedIds.includes(attendedSession._id.toString()),
      false,
      'Already attended session must be excluded from recommendations'
    );
  });

  it('should detect schedule conflicts and split into itinerary vs conflicting alternatives', async () => {
    const res = await request(app)
      .get(`/api/v1/ai/recommendations/${event._id}`)
      .set('Authorization', `Bearer ${attendeeToken}`);

    assert.equal(res.status, 200);
    const data = res.body.data;

    const itineraryIds = data.recommendedItinerary.map((s) => s.sessionId);
    const alternativeIds = data.conflictingAlternatives.map((s) => s.sessionId);

    // sessionAI1 (higher similarity) should win and be in itinerary
    // sessionAI2Conflict should be in conflictingAlternatives
    assert.ok(itineraryIds.includes(sessionAI1._id.toString()));
    assert.ok(alternativeIds.includes(sessionAI2Conflict._id.toString()));

    const conflictingItem = data.conflictingAlternatives.find(
      (s) => s.sessionId === sessionAI2Conflict._id.toString()
    );
    assert.ok(conflictingItem.conflictsWith);
    assert.equal(conflictingItem.conflictsWith.sessionId, sessionAI1._id.toString());
    assert.ok(conflictingItem.conflictsWith.conflictingWindow);
  });

  it('should rank sessions by similarity score descending in itinerary', async () => {
    const res = await request(app)
      .get(`/api/v1/ai/recommendations/${event._id}`)
      .set('Authorization', `Bearer ${attendeeToken}`);

    assert.equal(res.status, 200);
    const itinerary = res.body.data.recommendedItinerary;

    for (let i = 1; i < itinerary.length; i++) {
      assert.ok(
        itinerary[i - 1].similarityScore >= itinerary[i].similarityScore,
        'Itinerary should be sorted in descending order of similarity score'
      );
    }
  });

  it('should reject unauthenticated recommendation requests with 401 Unauthorized', async () => {
    const res = await request(app).get(`/api/v1/ai/recommendations/${event._id}`);
    assert.equal(res.status, 401);
  });
});
