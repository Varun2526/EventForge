import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../validators/authValidator.js';

const router = Router();

router.post('/register', authLimiter, validateRequest({ body: registerSchema }), AuthController.register);
router.post('/login', authLimiter, validateRequest({ body: loginSchema }), AuthController.login);
router.get('/me', authenticate, AuthController.getMe);
router.put('/profile', authenticate, validateRequest({ body: updateProfileSchema }), AuthController.updateProfile);

export default router;
