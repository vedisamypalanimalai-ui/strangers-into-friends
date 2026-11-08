const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const googleSheetsService = require('../services/googleSheetsService');

const JWT_SECRET = process.env.JWT_SECRET || 'sif_jwt_super_secret_key_8f3d9a1c6e4b2d7e_2026';
const TOKEN_EXPIRY = '7d';

// Generate safe random default avatar with initials or gradient
function getDefaultAvatar(fullName, username) {
  const name = encodeURIComponent(fullName || username || 'Stranger');
  return `https://ui-avatars.com/api/?name=${name}&background=7c3aed&color=ffffff&bold=true&rounded=true&size=200`;
}

class AuthController {
  /**
   * User Registration
   */
  async register(req, res) {
    try {
      const { fullName, username, mobile, email, password, dateOfBirth, gender, profilePicture, bio, location } = req.body;

      // Check if username or email already exists in Google Sheets
      const existingUser = await googleSheetsService.findUserByUsernameOrEmail(username);
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'Username is already taken. Please choose another.' });
      }

      const existingEmail = await googleSheetsService.findUserByUsernameOrEmail(email);
      if (existingEmail) {
        return res.status(400).json({ success: false, error: 'Email address is already registered. Please sign in.' });
      }

      // Hash password using bcrypt
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const userId = uuidv4();
      const avatar = profilePicture || getDefaultAvatar(fullName, username);

      const newUserData = {
        userId,
        fullName,
        username,
        mobile,
        email,
        passwordHash,
        dateOfBirth,
        gender: gender || 'Not specified',
        bio: bio || 'Hello! I am new here, looking forward to meeting friends.',
        location: location || '',
        profilePicture: avatar,
        role: 'user'
      };

      // Save user to Google Sheets Users tab
      const savedUser = await googleSheetsService.createUser(newUserData);

      // Generate JWT
      const token = jwt.sign(
        { userId: savedUser.UserID, username: savedUser.Username, role: savedUser.Role },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      // Save session in Google Sheets Sessions tab
      await googleSheetsService.saveSession({
        userId: savedUser.UserID,
        token: token,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      // Set cookie
      res.cookie('sif_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.status(201).json({
        success: true,
        message: 'Account created successfully! Welcome to Strangers Into Friends.',
        token,
        user: savedUser
      });
    } catch (err) {
      console.error('Registration error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Error completing registration.' });
    }
  }

  /**
   * User Login
   */
  async login(req, res) {
    try {
      const { identifier, password } = req.body;

      // Find user in Google Sheets (include private fields to verify password)
      const user = await googleSheetsService.findUserByUsernameOrEmail(identifier);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid username/email or password.' });
      }

      if (user.Status === 'suspended') {
        return res.status(403).json({ 
          success: false, 
          error: 'Your account has been suspended by an administrator. Please contact support.' 
        });
      }

      // Verify bcrypt password hash
      const isMatch = await bcrypt.compare(password, user.PasswordHash);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid username/email or password.' });
      }

      // Update LastLogin timestamp in Google Sheets
      await googleSheetsService.updateUser(user.UserID, {
        LastLogin: new Date().toISOString()
      });

      // Generate JWT
      const token = jwt.sign(
        { userId: user.UserID, username: user.Username, role: user.Role },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      // Save session in Google Sheets
      await googleSheetsService.saveSession({
        userId: user.UserID,
        token: token,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      // Set cookie
      res.cookie('sif_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      // Return user without password hash
      const safeUser = { ...user };
      delete safeUser.PasswordHash;

      return res.json({
        success: true,
        message: 'Signed in successfully. Welcome back!',
        token,
        user: safeUser
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Login failed.' });
    }
  }

  /**
   * User Logout
   */
  async logout(req, res) {
    try {
      if (req.token) {
        await googleSheetsService.invalidateSession(req.token);
      }
      res.clearCookie('sif_token');
      return res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, error: 'Error during logout.' });
    }
  }

  /**
   * Get Current Authenticated User Profile
   */
  async getMe(req, res) {
    try {
      const user = await googleSheetsService.getUserById(req.user.UserID, false);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }
      return res.json({ success: true, user });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to retrieve profile.' });
    }
  }

  /**
   * Request Password Reset Token
   */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Please enter your registered email address.' });
      }

      const user = await googleSheetsService.findUserByUsernameOrEmail(email);
      if (!user) {
        // Return generic success response for security (avoid email enumeration)
        return res.json({ 
          success: true, 
          message: 'If an account exists with this email, password reset instructions have been generated.' 
        });
      }

      // Generate a temporary 6-digit verification code or token
      const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store in Sessions sheet as reset request
      await googleSheetsService.saveSession({
        userId: user.UserID,
        token: 'RESET_' + resetToken,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
      });

      return res.json({
        success: true,
        message: 'Password reset code generated. For demonstration/testing, use code: ' + resetToken,
        resetToken: resetToken,
        email: user.Email
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Password reset request failed.' });
    }
  }

  /**
   * Complete Password Reset
   */
  async resetPassword(req, res) {
    try {
      const { email, resetCode, newPassword } = req.body;

      if (!email || !resetCode || !newPassword) {
        return res.status(400).json({ success: false, error: 'Email, reset code, and new password are required.' });
      }

      if (String(newPassword).length < 6) {
        return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
      }

      const user = await googleSheetsService.findUserByUsernameOrEmail(email);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Account not found.' });
      }

      // Hash new password with bcrypt
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      // Update in Google Sheets
      await googleSheetsService.resetPassword(user.UserID, newHash);

      // Invalidate the reset token
      await googleSheetsService.invalidateSession('RESET_' + resetCode);

      return res.json({ success: true, message: 'Password reset successfully! You can now log in with your new password.' });
    } catch (err) {
      console.error('Password reset error:', err);
      return res.status(500).json({ success: false, error: 'Failed to reset password.' });
    }
  }
}

module.exports = new AuthController();
