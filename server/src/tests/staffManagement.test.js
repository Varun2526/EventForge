import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Event from '../models/Event.js';
import StaffAssignment from '../models/StaffAssignment.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eventforge_test_suite?directConnection=true';

describe('Phase 4 — Operational Staff Management Test Suite', () => {
  let adminUser, adminToken;
  let organizerUser, organizerToken;
  let regularUser, regularToken;
  let targetStaffUser, targetStaffToken;
  let org;
  let event;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await StaffAssignment.deleteMany({});
      await Event.deleteMany({});
      await Organization.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await StaffAssignment.deleteMany({});
    await Event.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    adminUser = await User.create({
      name: 'Platform Admin',
      email: 'admin@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'platform_admin'
    });
    adminToken = signToken({ id: adminUser._id.toString(), globalRole: 'platform_admin', email: adminUser.email });

    organizerUser = await User.create({
      name: 'Event Organizer',
      email: 'organizer@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    organizerToken = signToken({ id: organizerUser._id.toString(), globalRole: 'user', email: organizerUser.email });

    regularUser = await User.create({
      name: 'Regular Attendee',
      email: 'attendee@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    regularToken = signToken({ id: regularUser._id.toString(), globalRole: 'user', email: regularUser.email });

    targetStaffUser = await User.create({
      name: 'Prospective Staff',
      email: 'staffmember@eventforge.com',
      passwordHash: 'Password123!',
      globalRole: 'user'
    });
    targetStaffToken = signToken({ id: targetStaffUser._id.toString(), globalRole: 'user', email: targetStaffUser.email });

    org = await Organization.create({
      name: 'Staff Ops Corp',
      slug: 'staff-ops-corp',
      ownerRef: organizerUser._id,
      members: [{ userRef: organizerUser._id, role: 'owner' }]
    });

    event = await Event.create({
      organizationRef: org._id,
      organizerRef: organizerUser._id,
      title: 'Global Summit 2026',
      slug: 'global-summit-2026',
      type: 'conference',
      description: 'Global Summit 2026 Conference',
      totalCapacity: 1000,
      status: 'published',
      startDate: new Date('2026-11-01T09:00:00Z'),
      endDate: new Date('2026-11-03T18:00:00Z')
    });
  });

  it('should allow organizer to assign a staff member to an event (200 OK)', async () => {
    const res = await request(app)
      .post('/api/v1/staff/assign')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        eventId: event._id.toString(),
        userId: targetStaffUser._id.toString(),
        role: 'checkin_staff'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.staffAssignment.role, 'checkin_staff');
    assert.equal(res.body.data.staffAssignment.status, 'active');

    const dbAssignment = await StaffAssignment.findOne({
      eventRef: event._id,
      userRef: targetStaffUser._id
    });
    assert.ok(dbAssignment);
    assert.equal(dbAssignment.role, 'checkin_staff');
  });

  it('should allow platform admin to assign a staff member (200 OK)', async () => {
    const res = await request(app)
      .post('/api/v1/staff/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        eventId: event._id.toString(),
        userId: targetStaffUser._id.toString(),
        role: 'room_monitor'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.staffAssignment.role, 'room_monitor');
  });

  it('should forbid unauthorized user from assigning staff (403 FORBIDDEN)', async () => {
    const res = await request(app)
      .post('/api/v1/staff/assign')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        eventId: event._id.toString(),
        userId: targetStaffUser._id.toString(),
        role: 'usher'
      });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('should list staff members for an event (200 OK)', async () => {
    await StaffAssignment.create({
      eventRef: event._id,
      userRef: targetStaffUser._id,
      role: 'checkin_staff',
      status: 'active'
    });

    const res = await request(app)
      .get(`/api/v1/staff/event/${event._id}`)
      .set('Authorization', `Bearer ${organizerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.staffAssignments));
    assert.equal(res.body.data.staffAssignments.length, 1);
    assert.equal(res.body.data.staffAssignments[0].userRef.email, targetStaffUser.email);
  });
});
