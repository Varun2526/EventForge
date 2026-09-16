import { AuthService } from '../services/authService.js';

export class AuthController {
  /**
   * POST /api/v1/auth/register
   */
  static async register(req, res, next) {
    try {
      const { user, token } = await AuthService.register(req.body);
      res.status(201).json({
        success: true,
        data: {
          user,
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  static async login(req, res, next) {
    try {
      const { user, token } = await AuthService.login(req.body);
      res.status(200).json({
        success: true,
        data: {
          user,
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  static async getMe(req, res, next) {
    try {
      const user = await AuthService.getProfile(req.user._id);
      res.status(200).json({
        success: true,
        data: {
          user
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/auth/profile
   */
  static async updateProfile(req, res, next) {
    try {
      const updatedUser = await AuthService.updateProfile(req.user._id, req.body);
      res.status(200).json({
        success: true,
        data: {
          user: updatedUser
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
