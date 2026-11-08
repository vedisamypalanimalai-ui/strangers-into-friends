const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');
const authMiddleware = require('../middleware/authMiddleware');

// Public auth endpoints with rate limiting
router.post('/register', authLimiter, validateRegistration, (req, res) => authController.register(req, res));
router.post('/login', authLimiter, validateLogin, (req, res) => authController.login(req, res));
router.post('/forgot-password', authLimiter, (req, res) => authController.forgotPassword(req, res));
router.post('/reset-password', authLimiter, (req, res) => authController.resetPassword(req, res));

// Authenticated session endpoints
router.post('/logout', authMiddleware, (req, res) => authController.logout(req, res));
router.get('/me', authMiddleware, (req, res) => authController.getMe(req, res));

module.exports = router;
