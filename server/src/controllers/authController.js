import { AuthService } from '../services/authService.js';

export class AuthController {
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
