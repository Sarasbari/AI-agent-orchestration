const jwt = require('jsonwebtoken');
const config = require('../config');
const { AppError } = require('./errorHandler');

/**
 * JWT authentication middleware.
 * Extracts Bearer token, verifies JWT, sets req.user = { id }.
 * Returns 401 on missing/invalid/expired token.
 */
const authenticate = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Access token expired', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid access token', 401, 'INVALID_TOKEN');
  }
};

module.exports = authenticate;
