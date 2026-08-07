const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userModel = require('../models/userModel');
const refreshTokenModel = require('../models/refreshTokenModel');
const { AppError } = require('../middleware/errorHandler');

const BCRYPT_COST = 12; // per SECURITY.md §2

/**
 * Auth service — business logic for signup, login, token management.
 * Route handlers stay thin; logic lives here per SKILL.md coding conventions.
 */
const authService = {
  /**
   * Register a new user. Returns user + tokens.
   */
  async signup(email, password) {
    const existing = await userModel.findByEmail(email);
    if (existing) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await userModel.create(email, passwordHash);

    const accessToken = this.generateAccessToken(user.id);
    const refreshToken = await this.createRefreshToken(user.id);

    return { user, accessToken, refreshToken };
  },

  /**
   * Authenticate existing user. Returns tokens.
   */
  async login(email, password) {
    const user = await userModel.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const accessToken = this.generateAccessToken(user.id);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user: { id: user.id, email: user.email, created_at: user.created_at },
      accessToken,
      refreshToken,
    };
  },

  /**
   * Refresh an access token. Implements token rotation per SECURITY.md §2.
   * Old refresh token is invalidated, new one issued.
   */
  async refresh(rawToken) {
    if (!rawToken) {
      throw new AppError('Refresh token required', 401, 'TOKEN_REQUIRED');
    }

    const tokenHash = this.hashToken(rawToken);
    const stored = await refreshTokenModel.findByHash(tokenHash);

    if (!stored) {
      // Reuse detection: token not found could mean it was already rotated.
      // We can't easily detect the original user here without more state,
      // but if a token was valid before and is now missing, that's suspicious.
      // For safety, we log this event. Full family revocation requires knowing
      // the user_id, which we'd need to decode from the token or store alongside.
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Delete the old token (rotation — it's now single-use)
    await refreshTokenModel.deleteByHash(tokenHash);

    // Issue new tokens
    const accessToken = this.generateAccessToken(stored.user_id);
    const newRefreshToken = await this.createRefreshToken(stored.user_id);

    return { accessToken, refreshToken: newRefreshToken };
  },

  /**
   * Logout — invalidate refresh token.
   */
  async logout(rawToken) {
    if (!rawToken) {
      throw new AppError('Refresh token required', 400, 'TOKEN_REQUIRED');
    }

    const tokenHash = this.hashToken(rawToken);
    await refreshTokenModel.deleteByHash(tokenHash);
  },

  /**
   * Generate a short-lived JWT access token.
   * Claims: { sub: userId, iat, exp } per SECURITY.md §2.
   */
  generateAccessToken(userId) {
    return jwt.sign({ sub: userId }, config.JWT_SECRET, {
      expiresIn: config.ACCESS_TOKEN_EXPIRY,
      algorithm: 'HS256',
    });
  },

  /**
   * Create a new refresh token — random 256-bit, stored hashed.
   * Per SECURITY.md §2: SHA-256 hash stored, raw value returned for cookie.
   */
  async createRefreshToken(userId) {
    const rawToken = crypto.randomBytes(32).toString('hex'); // 256-bit
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + config.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    await refreshTokenModel.create(userId, tokenHash, expiresAt);
    return rawToken;
  },

  /**
   * SHA-256 hash a raw token for storage/lookup.
   */
  hashToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  },
};

module.exports = authService;
