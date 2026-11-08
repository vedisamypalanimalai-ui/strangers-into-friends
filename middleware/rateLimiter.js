const rateLimit = require('express-rate-limit');

// General API rate limiter: 120 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after a minute.'
  }
});

// Stricter rate limiter for Authentication endpoints: 15 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login or registration attempts. Please wait 15 minutes before trying again.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter
};
