import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Venue from '../models/Venue.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventforge_test_suite';

describe('Phase 2 — Venue & Room Management Test Suite', () => {
  let ownerUser;
  let ownerToken;
  let outsiderUser;
  let outsiderToken;
  let testOrg;
  let createdVenue;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Venue.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await Venue.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    // 1. Create Organization Owner
    ownerUser = await User.create({
      name: 'Venue Owner',
      email: 'owner@techcorp.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    ownerToken = signToken({ id: ownerUser._id.toString(), globalRole: 'user', email: ownerUser.email });

    // 2. Create Outsider User
    outsiderUser = await User.create({
      name: 'Outsider User',
      email: 'outsider@othercorp.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    outsiderToken = signToken({ id: outsiderUser._id.toString(), globalRole: 'user', email: outsiderUser.email });

    // 3. Create Organization
    testOrg = await Organization.create({
      name: 'TechCorp Events',
      slug: 'techcorp-events',
      ownerRef: ownerUser._id,
      members: [{ userRef: ownerUser._id, role: 'owner' }]
    });

    // 4. Create base venue for owner
    createdVenue = await Venue.create({
      name: 'TechCorp Convention Center',
      organizationRef: testOrg._id,
      address: {
        street: '100 Innovation Way',
        city: 'San Francisco',
        country: 'USA'
      },
      capacity: 1000,
      rooms: [
        {
          name: 'Main Auditorium',
          floor: '1',
          capacity: 500,
          avEquipment: ['Projector', 'Mics']
        }
      ]
    });
  });

  // ==========================================
  // VENUE CRUD & CROSS-ORG AUTHORIZATION
  // ==========================================
  describe('Venue CRUD', () => {
    it('should allow organization owner to create a venue (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Silicon Hub',
          organizationRef: testOrg._id.toString(),
          address: {
            street: '200 Tech Blvd',
            city: 'San Jose',
            country: 'USA'
          },
          capacity: 500,
          rooms: [{ name: 'Room 1', capacity: 100 }]
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.venue.name, 'Silicon Hub');
      assert.equal(res.body.data.venue.rooms.length, 1);
    });

    it('should forbid user from another organization from creating a venue (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          name: 'Intruder Venue',
          organizationRef: testOrg._id.toString(),
          address: {
            street: '99 Shadow St',
            city: 'San Jose',
            country: 'USA'
          },
          capacity: 100
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should list venues accessible to the user (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/venues')
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.venues));
      assert.equal(res.body.data.venues.length, 1);
    });

    it('should update venue details for authorized owner (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/venues/${createdVenue._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'TechCorp Grand Center',
          capacity: 1500
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.venue.name, 'TechCorp Grand Center');
      assert.equal(res.body.data.venue.capacity, 1500);
    });

    it('should delete venue for authorized owner (200 OK)', async () => {
      const res = await request(app)
        .delete(`/api/v1/venues/${createdVenue._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const check = await Venue.findById(createdVenue._id);
      assert.equal(check, null);
    });
  });

  // ==========================================
  // ROOM SUB-RESOURCE CRUD
  // ==========================================
  describe('Room Sub-resource Management', () => {
    it('should add a room to an existing venue (201 Created)', async () => {
      const res = await request(app)
        .post(`/api/v1/venues/${createdVenue._id}/rooms`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Breakout Room Alpha',
          floor: '2',
          capacity: 50,
          avEquipment: ['Whiteboard', 'Screen']
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.room.name, 'Breakout Room Alpha');
      assert.equal(res.body.data.room.capacity, 50);

      // Verify embedded in venue document
      const updatedVenue = await Venue.findById(createdVenue._id);
      assert.equal(updatedVenue.rooms.length, 2);
    });

    it('should reject duplicate room name within the same venue (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/v1/venues/${createdVenue._id}/rooms`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Main Auditorium', // Already exists in beforeEach
          capacity: 200
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'CONFLICT');
    });

    it('should update room details (200 OK)', async () => {
      const roomId = createdVenue.rooms[0]._id.toString();

      const res = await request(app)
        .put(`/api/v1/venues/${createdVenue._id}/rooms/${roomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Main Auditorium Renovation',
          capacity: 600
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.room.capacity, 600);
      assert.equal(res.body.data.room.name, 'Main Auditorium Renovation');
    });

    it('should delete a room from a venue (200 OK)', async () => {
      const roomId = createdVenue.rooms[0]._id.toString();

      const res = await request(app)
        .delete(`/api/v1/venues/${createdVenue._id}/rooms/${roomId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const updatedVenue = await Venue.findById(createdVenue._id);
      assert.equal(updatedVenue.rooms.length, 0);
    });
  });
});
