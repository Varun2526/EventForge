import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { signToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';

export class AuthService {
  /**
   * Register a new user account.
   */
  static async register({ name, email, password, company, jobTitle, phone, interests }) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('An account with this email address already exists.', 409, 'CONFLICT');
    }

    const user = await User.create({
      name,
      email,
      passwordHash: password, // Mongoose pre-save hook handles bcrypt hashing
      company: company || '',
      jobTitle: jobTitle || '',
      phone: phone || '',
      interests: interests || [],
      globalRole: 'user', // Initial registrations default to standard user
      lastLoginAt: new Date()
    });

    const token = signToken({
      id: user._id.toString(),
      globalRole: user.globalRole,
      email: user.email
    });

    return { user, token };
  }

  /**
   * Authenticate user with email and password credentials.
   */
  static async login({ email, password }) {
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      throw new AppError('Invalid email address or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Please contact support.', 403, 'ACCOUNT_DEACTIVATED');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email address or password.', 401, 'INVALID_CREDENTIALS');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({
      id: user._id.toString(),
      globalRole: user.globalRole,
      email: user.email
    });

    // Remove passwordHash before returning
    const userObj = user.toObject();

    return { user: userObj, token };
  }

  /**
   * Fetch current user profile with organization details.
   */
  static async getProfile(userId) {
    const user = await User.findById(userId).populate('organizationRef', 'name slug logoUrl subscription');
    if (!user) {
      throw new AppError('User account not found.', 404, 'NOT_FOUND');
    }
    return user;
  }

  /**
   * Update current user profile.
   */
  static async updateProfile(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User account not found.', 404, 'NOT_FOUND');
    }

    const allowedUpdates = ['name', 'company', 'jobTitle', 'phone', 'avatarUrl', 'interests'];
    allowedUpdates.forEach((field) => {
      if (updateData[field] !== undefined) {
        user[field] = updateData[field];
      }
    });

    await user.save();
    return user;
  }
}
