/**
 * Request Validation & Sanitization Middleware
 */

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validateMobile(mobile) {
  const clean = String(mobile).replace(/[\s\-\(\)\+]/g, '');
  return /^\d{7,15}$/.test(clean);
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_]{3,25}$/.test(String(username));
}

function calculateAge(dobString) {
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return -1;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function validateRegistration(req, res, next) {
  const { fullName, username, mobile, email, password, dateOfBirth, gender } = req.body;

  if (!fullName || String(fullName).trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Full name must be at least 2 characters.' });
  }

  if (!username || !validateUsername(username)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Username must be 3-25 characters long and contain only letters, numbers, and underscores.' 
    });
  }

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
  }

  if (!mobile || !validateMobile(mobile)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid mobile phone number (7-15 digits).' });
  }

  if (!password || String(password).length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
  }

  if (!dateOfBirth) {
    return res.status(400).json({ success: false, error: 'Date of birth is required.' });
  }

  const age = calculateAge(dateOfBirth);
  if (age < 18) {
    return res.status(400).json({ 
      success: false, 
      error: 'You must be at least 18 years old to join Strangers Into Friends.' 
    });
  }

  // Sanitized body parameters
  req.body.fullName = sanitizeString(fullName);
  req.body.username = String(username).trim().toLowerCase();
  req.body.email = String(email).trim().toLowerCase();
  req.body.mobile = String(mobile).trim();
  req.body.gender = sanitizeString(gender || 'Prefer not to say');

  next();
}

function validateLogin(req, res, next) {
  const { identifier, password } = req.body;

  if (!identifier || !String(identifier).trim()) {
    return res.status(400).json({ success: false, error: 'Username or Email is required.' });
  }

  if (!password || !String(password).trim()) {
    return res.status(400).json({ success: false, error: 'Password is required.' });
  }

  req.body.identifier = String(identifier).trim().toLowerCase();
  next();
}

module.exports = {
  sanitizeString,
  validateEmail,
  validateMobile,
  validateUsername,
  calculateAge,
  validateRegistration,
  validateLogin
};
