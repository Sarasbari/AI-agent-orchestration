const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');
const { asyncHandler } = require('../middleware/errorHandler');
const config = require('../config');

const router = express.Router();

// --- Zod schemas ---
const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  // Refresh token comes from httpOnly cookie, not body.
  // Validation happens in route handler.
});

// --- Rate limiting per SECURITY.md §6 ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  keyGenerator: (req) => req.ip,
  message: { error: { message: 'Too many login attempts, try again later', code: 'RATE_LIMITED' } },
});

// --- Cookie config for refresh tokens ---
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: config.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

/**
 * POST /api/auth/signup
 * Creates user, returns access token in body + refresh token as httpOnly cookie.
 */
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { email, password } = signupSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.signup(email, password);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
      accessToken,
    });
  }),
);

/**
 * POST /api/auth/login
 * Authenticates user, returns access token in body + refresh token as httpOnly cookie.
 */
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.login(email, password);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
      accessToken,
    });
  }),
);

/**
 * POST /api/auth/refresh
 * Rotates refresh token, issues new access token.
 * Refresh token read from httpOnly cookie per SECURITY.md §2.
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const rawToken = req.cookies.refreshToken;
    const { accessToken, refreshToken } = await authService.refresh(rawToken);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ accessToken });
  }),
);

/**
 * POST /api/auth/logout
 * Invalidates refresh token server-side, clears cookie.
 */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const rawToken = req.cookies.refreshToken;
    await authService.logout(rawToken);

    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(204).send();
  }),
);

module.exports = router;
