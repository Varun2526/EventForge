import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { QRVerificationEngine } from '../services/qrVerificationEngine.js';
import { AppError } from '../utils/AppError.js';

describe('Phase 4 — Cryptographic QR Verification Engine Test Suite', () => {
  const secret = 'test_badge_hmac_secret_key_minimum_32bytes!';
  const samplePass = {
    passNumber: 'EF-2026-TEST-1',
    regNum: 'EF-REG-2026-9999',
    eventId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    tierId: new mongoose.Types.ObjectId(),
    expiresInSeconds: 3600,
    secret
  };

  it('should successfully sign and verify a valid badge token', () => {
    const token = QRVerificationEngine.signBadgeToken(samplePass);
    assert.ok(typeof token === 'string');
    assert.ok(token.startsWith('EFB1.'));

    const claims = QRVerificationEngine.verifyBadgeToken(token, secret);
    assert.equal(claims.passNumber, samplePass.passNumber);
    assert.equal(claims.registrationNumber, samplePass.regNum);
    assert.equal(claims.eventId, samplePass.eventId.toString());
    assert.equal(claims.userId, samplePass.userId.toString());
    assert.equal(claims.ticketTierId, samplePass.tierId.toString());
    assert.ok(claims.issuedAt instanceof Date);
    assert.ok(claims.expiresAt instanceof Date);
    assert.ok(claims.expiresAt.getTime() > claims.issuedAt.getTime());
  });

  it('should reject a token with a tampered signature (400 BADGE_INVALID_SIGNATURE)', () => {
    const token = QRVerificationEngine.signBadgeToken(samplePass);
    const parts = token.split('.');
    // Tamper with signature
    const tamperedSig = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'b' : 'a') + parts[2].slice(-1);
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;

    assert.throws(
      () => QRVerificationEngine.verifyBadgeToken(tamperedToken, secret),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'BADGE_INVALID_SIGNATURE');
        return true;
      }
    );
  });

  it('should reject a token with tampered payload claims (400 BADGE_INVALID_SIGNATURE)', () => {
    const token = QRVerificationEngine.signBadgeToken(samplePass);
    const parts = token.split('.');
    // Tamper with payload
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    decoded.p = 'EF-2026-FORGED-PASS';
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    assert.throws(
      () => QRVerificationEngine.verifyBadgeToken(tamperedToken, secret),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'BADGE_INVALID_SIGNATURE');
        return true;
      }
    );
  });

  it('should reject an expired badge token (400 BADGE_EXPIRED)', () => {
    const expiredPass = {
      ...samplePass,
      expiresInSeconds: -10 // expired 10 seconds ago
    };
    const token = QRVerificationEngine.signBadgeToken(expiredPass);

    assert.throws(
      () => QRVerificationEngine.verifyBadgeToken(token, secret),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'BADGE_EXPIRED');
        return true;
      }
    );
  });

  it('should reject malformed tokens with wrong prefix or invalid structure (400 INVALID_BADGE)', () => {
    const testCases = [
      'invalid.token',
      'EFB2.payload.signature',
      '',
      null,
      12345,
      'EFB1.onlyonepart'
    ];

    for (const badToken of testCases) {
      assert.throws(
        () => QRVerificationEngine.verifyBadgeToken(badToken, secret),
        (err) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          return true;
        }
      );
    }
  });

  it('should reject a token missing essential identity claims (400 INVALID_BADGE)', () => {
    const incompletePayload = JSON.stringify({
      p: 'EF-PASS-1',
      // missing r, e, u, t
      iat: Math.floor(Date.now() / 1000)
    });
    const sig = crypto.createHmac('sha256', secret).update(incompletePayload).digest('hex');
    const token = `EFB1.${Buffer.from(incompletePayload).toString('base64url')}.${sig}`;

    assert.throws(
      () => QRVerificationEngine.verifyBadgeToken(token, secret),
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'INVALID_BADGE');
        return true;
      }
    );
  });

  it('should enforce pass identity vs registration identity isolation in multi-pass orders', () => {
    const orderRegNum = 'EF-REG-MULTI-2026';
    const pass1 = {
      ...samplePass,
      regNum: orderRegNum,
      passNumber: `${orderRegNum}-1`
    };
    const pass2 = {
      ...samplePass,
      regNum: orderRegNum,
      passNumber: `${orderRegNum}-2`
    };

    const token1 = QRVerificationEngine.signBadgeToken(pass1);
    const token2 = QRVerificationEngine.signBadgeToken(pass2);

    assert.notEqual(token1, token2);

    const claims1 = QRVerificationEngine.verifyBadgeToken(token1, secret);
    const claims2 = QRVerificationEngine.verifyBadgeToken(token2, secret);

    assert.equal(claims1.registrationNumber, orderRegNum);
    assert.equal(claims2.registrationNumber, orderRegNum);
    assert.equal(claims1.passNumber, `${orderRegNum}-1`);
    assert.equal(claims2.passNumber, `${orderRegNum}-2`);
    assert.notEqual(claims1.passNumber, claims2.passNumber);
  });
});
