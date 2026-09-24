import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './authRoutes.js';
import eventRoutes from './eventRoutes.js';
import venueRoutes from './venueRoutes.js';
import speakerRoutes from './speakerRoutes.js';
import sessionRoutes from './sessionRoutes.js';
import ticketRoutes from './ticketRoutes.js';
import couponRoutes from './couponRoutes.js';
import registrationRoutes from './registrationRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import checkInRoutes from './checkInRoutes.js';
import staffRoutes from './staffRoutes.js';
import aiRoutes from './aiRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import sponsorRoutes from './sponsorRoutes.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireGlobalRole } from '../middleware/rbacMiddleware.js';

const router = Router();

// Health Check (two-tier: process alive + database connected)
router.get('/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const status = isDbConnected ? 'healthy' : 'degraded';
  const statusCode = isDbConnected ? 200 : 503;

  res.status(statusCode).json({
    success: isDbConnected,
    data: {
      status,
      database: isDbConnected ? 'connected' : 'disconnected',
      service: 'EventForge API',
      timestamp: new Date().toISOString()
    }
  });
});

// Mount Domain Routes
router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/venues', venueRoutes);
router.use('/speakers', speakerRoutes);
router.use('/sessions', sessionRoutes);
router.use('/tickets', ticketRoutes);
router.use('/coupons', couponRoutes);
router.use('/registrations', registrationRoutes);
router.use('/payments', paymentRoutes);
router.use('/checkin', checkInRoutes);
router.use('/staff', staffRoutes);
router.use('/ai', aiRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/sponsors', sponsorRoutes);

// RBAC Protected Test Route for Platform Admins (used in tests and monitoring)
router.get('/admin/ping', authenticate, requireGlobalRole('platform_admin'), (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Admin access confirmed.',
      adminUser: req.user.email
    }
  });
});

export default router;
