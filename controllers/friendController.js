const googleSheetsService = require('../services/googleSheetsService');
const socketService = require('../services/socketService');

class FriendController {
  /**
   * Get active friends list
   */
  async getFriends(req, res) {
    try {
      const friends = await googleSheetsService.getFriendsList(req.user.UserID);

      // Add online status
      const friendsWithStatus = friends.map(f => ({
        ...f,
        isOnline: socketService.isUserOnline(f.UserID)
      }));

      return res.json({ success: true, friends: friendsWithStatus });
    } catch (err) {
      console.error('Error fetching friends:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve friends list.' });
    }
  }

  /**
   * Get pending friend requests (received and sent)
   */
  async getFriendRequests(req, res) {
    try {
      const requests = await googleSheetsService.getFriendRequests(req.user.UserID);
      return res.json({ success: true, ...requests });
    } catch (err) {
      console.error('Error fetching friend requests:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve friend requests.' });
    }
  }

  /**
   * Send friend request to another user
   */
  async sendFriendRequest(req, res) {
    try {
      const { receiverId } = req.body;
      if (!receiverId) {
        return res.status(400).json({ success: false, error: 'Receiver ID is required.' });
      }

      if (String(receiverId) === String(req.user.UserID)) {
        return res.status(400).json({ success: false, error: 'You cannot send a friend request to yourself.' });
      }

      // Check if receiver is blocked
      const blocked = await googleSheetsService.getBlockedUsers(req.user.UserID);
      if (blocked.some(b => String(b.BlockedID) === String(receiverId))) {
        return res.status(400).json({ success: false, error: 'You cannot send a request to a blocked user.' });
      }

      const request = await googleSheetsService.sendFriendRequest(req.user.UserID, receiverId);

      // Notify receiver in real time via socket
      socketService.emitToUser(receiverId, 'new_friend_request', {
        request: request,
        sender: {
          UserID: req.user.UserID,
          FullName: req.user.FullName,
          Username: req.user.Username,
          ProfilePicture: req.user.ProfilePicture
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Friend request sent successfully!',
        request
      });
    } catch (err) {
      console.error('Error sending friend request:', err);
      return res.status(400).json({ success: false, error: err.message || 'Failed to send friend request.' });
    }
  }

  /**
   * Respond to friend request (accept or reject)
   */
  async respondFriendRequest(req, res) {
    try {
      const { requestId, action } = req.body; // action: 'accept' or 'reject'
      if (!requestId || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, error: 'Valid request ID and action (accept/reject) are required.' });
      }

      const result = await googleSheetsService.respondFriendRequest(requestId, req.user.UserID, action);

      return res.json({
        success: true,
        message: action === 'accept' ? 'Friend request accepted! You are now friends.' : 'Friend request declined.',
        result
      });
    } catch (err) {
      console.error('Error responding to friend request:', err);
      return res.status(400).json({ success: false, error: err.message || 'Failed to respond to request.' });
    }
  }

  /**
   * Remove friend (unfriend)
   */
  async removeFriend(req, res) {
    try {
      const { friendId } = req.body;
      if (!friendId) {
        return res.status(400).json({ success: false, error: 'Friend ID is required.' });
      }

      await googleSheetsService.removeFriend(req.user.UserID, friendId);

      return res.json({ success: true, message: 'Friend removed from your friends list.' });
    } catch (err) {
      console.error('Error removing friend:', err);
      return res.status(400).json({ success: false, error: err.message || 'Failed to remove friend.' });
    }
  }

  /**
   * Block a user
   */
  async blockUser(req, res) {
    try {
      const { blockedId, reason } = req.body;
      if (!blockedId) {
        return res.status(400).json({ success: false, error: 'User ID to block is required.' });
      }

      const result = await googleSheetsService.blockUser(req.user.UserID, blockedId, reason);

      return res.json({ success: true, message: 'User blocked successfully.', result });
    } catch (err) {
      console.error('Error blocking user:', err);
      return res.status(400).json({ success: false, error: err.message || 'Failed to block user.' });
    }
  }

  /**
   * Unblock a user
   */
  async unblockUser(req, res) {
    try {
      const { blockedId } = req.body;
      if (!blockedId) {
        return res.status(400).json({ success: false, error: 'User ID to unblock is required.' });
      }

      await googleSheetsService.unblockUser(req.user.UserID, blockedId);

      return res.json({ success: true, message: 'User unblocked successfully.' });
    } catch (err) {
      console.error('Error unblocking user:', err);
      return res.status(400).json({ success: false, error: 'Failed to unblock user.' });
    }
  }

  /**
   * Get list of blocked users
   */
  async getBlockedUsers(req, res) {
    try {
      const blocked = await googleSheetsService.getBlockedUsers(req.user.UserID);
      const allUsers = await googleSheetsService.getAllUsers();
      const userMap = {};
      allUsers.forEach(u => { userMap[u.UserID] = u; });

      const detailed = blocked.map(b => ({
        ...b,
        user: userMap[b.BlockedID] || { UserID: b.BlockedID, FullName: 'Blocked User', Username: 'unknown' }
      }));

      return res.json({ success: true, blocked: detailed });
    } catch (err) {
      console.error('Error fetching blocked users:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch blocked users.' });
    }
  }

  /**
   * Report a user
   */
  async reportUser(req, res) {
    try {
      const { reportedUserId, reason, details } = req.body;
      if (!reportedUserId || !reason) {
        return res.status(400).json({ success: false, error: 'Reported user ID and reason are required.' });
      }

      const report = await googleSheetsService.reportUser({
        reporterId: req.user.UserID,
        reportedUserId,
        reason,
        details: details || ''
      });

      return res.status(201).json({
        success: true,
        message: 'Thank you for reporting. Our moderation team has been notified and will review this account.',
        report
      });
    } catch (err) {
      console.error('Error reporting user:', err);
      return res.status(500).json({ success: false, error: 'Failed to submit report.' });
    }
  }
}

module.exports = new FriendController();
