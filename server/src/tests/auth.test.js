import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import { signToken } from '../utils/jwt.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventforge_test_suite';

describe('Phase 1 — Foundation, Security, and Auth Test Suite', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    // Clean up test database and disconnect
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Clean users between test runs
    await User.deleteMany({});
  });

  // ==========================================
  // 1. REGISTRATION TESTS
  // ==========================================
  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a valid new user and return JWT', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Sarah Connor',
          email: 'sarah.connor@cyberdyne.com',
          password: 'Password123!',
          company: 'Resistance Ops',
          jobTitle: 'Commander',
          interests: ['defense', 'automation']
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.user.email, 'sarah.connor@cyberdyne.com');
      assert.equal(res.body.data.user.name, 'Sarah Connor');
      assert.equal(res.body.data.user.globalRole, 'user');
      // Password hash must never leak in response
      assert.equal(res.body.data.user.passwordHash, undefined);
    });

    it('should reject registration if email is already registered (409 Conflict)', async () => {
      // First registration
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Existing User',
          email: 'duplicate@test.com',
          password: 'Password123!'
        });

      // Duplicate registration attempt
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Second User',
          email: 'duplicate@test.com',
          password: 'AnotherPassword456!'
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'CONFLICT');
    });

    it('should reject registration with invalid email format (400 Validation Error)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Invalid Email User',
          email: 'not-an-email',
          password: 'Password123!'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(res.body.error.details));
      const emailIssue = res.body.error.details.find((d) => d.field === 'email');
      assert.ok(emailIssue);
    });

    it('should reject registration with missing password (400 Validation Error)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Missing Password User',
          email: 'nopass@test.com'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('should reject registration with weak password lacking numbers or uppercase (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Weak Password User',
          email: 'weakpass@test.com',
          password: 'alllowercase'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });
  });

  // ==========================================
  // 2. LOGIN TESTS
  // ==========================================
  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Login Test User',
          email: 'login.user@test.com',
          password: 'ValidPassword123!'
        });
    });

    it('should authenticate valid credentials and return JWT', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login.user@test.com',
          password: 'ValidPassword123!'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.user.email, 'login.user@test.com');
      assert.equal(res.body.data.user.passwordHash, undefined);
    });

    it('should reject login with wrong password (401 Invalid Credentials)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login.user@test.com',
          password: 'WrongPassword999!'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    });

    it('should reject login for unknown user email (401 Invalid Credentials)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'ghost@nowhere.com',
          password: 'Password123!'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    });
  });

  // ==========================================
  // 3. JWT AUTHENTICATION TESTS (/api/v1/auth/me)
  // ==========================================
  describe('GET /api/v1/auth/me (JWT Middleware)', () => {
    let validToken;
    let registeredUser;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'JWT Subject',
          email: 'jwt.subject@test.com',
          password: 'Password123!'
        });
      validToken = regRes.body.data.token;
      registeredUser = regRes.body.data.user;
    });

    it('should access protected profile with a valid Bearer token (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.email, 'jwt.subject@test.com');
    });

    it('should reject request without Authorization header (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject request with an invalid/forged JWT signature (401 Unauthorized)', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer forged.token.signature');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject request with an expired JWT token (401 Unauthorized)', async () => {
      // Generate expired token (expired 10 seconds ago)
      const expiredToken = signToken(
        { id: registeredUser._id, globalRole: 'user', email: registeredUser.email },
        '-10s'
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });
  });

  // ==========================================
  // 4. RBAC GLOBAL ROLE AUTHORIZATION TESTS
  // ==========================================
  describe('RBAC Global Role Authorization (/api/v1/admin/ping)', () => {
    let userToken;
    let adminToken;

    beforeEach(async () => {
      // 1. Regular user
      const userRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Regular Attendee',
          email: 'regular@test.com',
          password: 'Password123!'
        });
      userToken = userRes.body.data.token;

      // 2. Platform admin user
      const admin = await User.create({
        name: 'System Admin',
        email: 'admin@eventforge.io',
        passwordHash: 'AdminSecret123!',
        globalRole: 'platform_admin'
      });
      adminToken = signToken({
        id: admin._id.toString(),
        globalRole: 'platform_admin',
        email: admin.email
      });
    });

    it('should allow platform_admin access to admin endpoint (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/ping')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.adminUser, 'admin@eventforge.io');
    });

    it('should forbid standard user access to admin endpoint (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/ping')
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should reject unauthenticated access to admin endpoint (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/admin/ping');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });
  });

  // ==========================================
  // 5. ERROR HANDLING & SYSTEM INTEGRITY TESTS
  // ==========================================
  describe('System Error Handling & Envelopes', () => {
    it('should return a clean 404 for undefined routes in standard envelope', async () => {
      const res = await request(app).get('/api/v1/unknown-endpoint');

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('should return 400 for malformed JSON request bodies', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "broken-json,');

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'MALFORMED_JSON');
    });

    it('should respond with health check status at /api/v1/health', async () => {
      const res = await request(app).get('/api/v1/health');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'healthy');
    });
  });
});
