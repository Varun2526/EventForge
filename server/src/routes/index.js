import { Router } from 'express';
import authRoutes from './authRoutes.js';
import eventRoutes from './eventRoutes.js';
import venueRoutes from './venueRoutes.js';
import speakerRoutes from './speakerRoutes.js';
import sessionRoutes from './sessionRoutes.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireGlobalRole } from '../middleware/rbacMiddleware.js';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
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
