const bcrypt = require('bcryptjs');
const googleSheetsService = require('../services/googleSheetsService');

class SettingsController {
  /**
   * Change Password
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'Current password and new password are required.' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
      }

      // Fetch user with private fields to check hash
      const user = await googleSheetsService.getUserById(req.user.UserID, true);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.PasswordHash);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Current password does not match.' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      await googleSheetsService.resetPassword(req.user.UserID, newHash);

      return res.json({ success: true, message: 'Password updated successfully!' });
    } catch (err) {
      console.error('Change password error:', err);
      return res.status(500).json({ success: false, error: 'Failed to update password.' });
    }
  }

  /**
   * Get Notifications
   */
  async getNotifications(req, res) {
    try {
      const notifications = await googleSheetsService.getNotifications(req.user.UserID);
      return res.json({ success: true, notifications });
    } catch (err) {
      console.error('Error fetching notifications:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch notifications.' });
    }
  }

  /**
   * Mark Notifications as Read
   */
  async markNotificationsRead(req, res) {
    try {
      const { notificationIds } = req.body;
      await googleSheetsService.markNotificationsRead(req.user.UserID, notificationIds);
      return res.json({ success: true, message: 'Notifications marked as read.' });
    } catch (err) {
      console.error('Error updating notifications:', err);
      return res.status(500).json({ success: false, error: 'Failed to mark notifications read.' });
    }
  }
}

module.exports = new SettingsController();
