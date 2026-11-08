const jwt = require('jsonwebtoken');
const googleSheetsService = require('../services/googleSheetsService');

const JWT_SECRET = process.env.JWT_SECRET || 'sif_jwt_super_secret_key_8f3d9a1c6e4b2d7e_2026';

async function authMiddleware(req, res, next) {
  try {
    let token = null;

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.sif_token) {
      token = req.cookies.sif_token;
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required. Please sign in.' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid. Please sign in again.' });
    }

    // Fetch user from Google Sheets
    const user = await googleSheetsService.getUserById(decoded.userId, false);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User account not found.' });
    }

    if (user.Status === 'suspended') {
      return res.status(403).json({ 
        success: false, 
        error: 'Your account has been suspended by an administrator. Please contact support.' 
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ success: false, error: 'Internal authentication error.' });
  }
}

module.exports = authMiddleware;
