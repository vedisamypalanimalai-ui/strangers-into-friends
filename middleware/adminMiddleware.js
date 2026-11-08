/**
 * Admin Authorization Middleware
 * Verifies that the authenticated user possesses administrator privileges.
 * Strictly shields admin endpoints and never exposes password hashes.
 */

function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  if (req.user.Role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied: Administrator privileges required.' 
    });
  }

  next();
}

module.exports = adminMiddleware;
