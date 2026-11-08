const googleSheetsService = require('../services/googleSheetsService');
const socketService = require('../services/socketService');

class AdminController {
  /**
   * Get Admin Overview Statistics
   */
  async getStats(req, res) {
    try {
      const stats = await googleSheetsService.getAdminStats();
      const onlineCount = socketService.getOnlineCount();

      return res.json({
        success: true,
        stats: {
          ...stats,
          onlineUsers: onlineCount
        }
      });
    } catch (err) {
      console.error('Admin stats error:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve platform statistics.' });
    }
  }

  /**
   * Get all users for admin table (excludes password hashes)
   */
  async getUsers(req, res) {
    try {
      const { search, status } = req.query;
      const users = await googleSheetsService.getAllUsers(search || '', status || 'all');

      // Add live online indicator
      const usersWithStatus = users.map(u => ({
        ...u,
        isOnline: socketService.isUserOnline(u.UserID)
      }));

      return res.json({ success: true, users: usersWithStatus });
    } catch (err) {
      console.error('Admin getUsers error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch users list.' });
    }
  }

  /**
   * Suspend or Activate user account
   */
  async updateUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { status } = req.body; // 'active' or 'suspended'

      if (!['active', 'suspended'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Status must be "active" or "suspended".' });
      }

      if (String(userId) === String(req.user.UserID)) {
        return res.status(400).json({ success: false, error: 'Cannot change your own administrative account status.' });
      }

      const result = await googleSheetsService.updateUserStatus(userId, status);

      // If suspended, disconnect user's sockets immediately
      if (status === 'suspended') {
        socketService.emitToUser(userId, 'account_suspended', {
          message: 'Your account has been suspended by an administrator.'
        });
      }

      return res.json({
        success: true,
        message: `User account has been successfully set to ${status}.`,
        result
      });
    } catch (err) {
      console.error('Admin updateUserStatus error:', err);
      return res.status(500).json({ success: false, error: 'Failed to update user status.' });
    }
  }

  /**
   * Get all moderation reports
   */
  async getReports(req, res) {
    try {
      const { status } = req.query; // 'pending', 'reviewed', 'dismissed', 'all'
      const reports = await googleSheetsService.getAdminReports(status || 'all');
      return res.json({ success: true, reports });
    } catch (err) {
      console.error('Admin getReports error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch reports.' });
    }
  }

  /**
   * Update report status and moderation notes
   */
  async updateReportStatus(req, res) {
    try {
      const { reportId } = req.params;
      const { status, adminNotes, suspendUser, reportedUserId } = req.body;

      if (!reportId || !status) {
        return res.status(400).json({ success: false, error: 'Report ID and status are required.' });
      }

      const result = await googleSheetsService.updateReportStatus(reportId, status, adminNotes || '');

      // Optionally suspend user directly from report review
      if (suspendUser && reportedUserId) {
        await googleSheetsService.updateUserStatus(reportedUserId, 'suspended');
        socketService.emitToUser(reportedUserId, 'account_suspended', {
          message: 'Your account has been suspended following a moderation review.'
        });
      }

      return res.json({
        success: true,
        message: 'Report updated successfully.',
        result
      });
    } catch (err) {
      console.error('Admin updateReportStatus error:', err);
      return res.status(500).json({ success: false, error: 'Failed to update report.' });
    }
  }

  /**
   * Get platform settings
   */
  async getSettings(req, res) {
    try {
      const settings = await googleSheetsService.getSettings();
      return res.json({ success: true, settings });
    } catch (err) {
      console.error('Admin getSettings error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch settings.' });
    }
  }

  /**
   * Update a platform setting
   */
  async updateSetting(req, res) {
    try {
      const { key, value } = req.body;
      if (!key) {
        return res.status(400).json({ success: false, error: 'Setting key is required.' });
      }

      const result = await googleSheetsService.updateSetting(key, value);
      return res.json({
        success: true,
        message: `Setting "${key}" updated successfully.`,
        result
      });
    } catch (err) {
      console.error('Admin updateSetting error:', err);
      return res.status(500).json({ success: false, error: 'Failed to update setting.' });
    }
  }
}

module.exports = new AdminController();
