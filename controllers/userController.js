const googleSheetsService = require('../services/googleSheetsService');
const { sanitizeString } = require('../middleware/validation');

class UserController {
  /**
   * Get user profile by userId or username
   */
  async getProfile(req, res) {
    try {
      const { id, username } = req.query;
      let targetUser = null;

      if (id) {
        targetUser = await googleSheetsService.getUserById(id, false);
      } else if (username) {
        targetUser = await googleSheetsService.findUserByUsernameOrEmail(username);
        if (targetUser) delete targetUser.PasswordHash;
      } else {
        // Return current user's profile
        targetUser = await googleSheetsService.getUserById(req.user.UserID, false);
      }

      if (!targetUser) {
        return res.status(404).json({ success: false, error: 'User profile not found.' });
      }

      // Check friendship / relationship status with current logged in user
      let relationship = 'none';
      if (req.user && String(req.user.UserID) !== String(targetUser.UserID)) {
        const friends = await googleSheetsService.getFriendsList(req.user.UserID);
        if (friends.some(f => String(f.UserID) === String(targetUser.UserID))) {
          relationship = 'friend';
        } else {
          const reqs = await googleSheetsService.getFriendRequests(req.user.UserID);
          if (reqs.sent.some(r => String(r.Receiver.UserID) === String(targetUser.UserID))) {
            relationship = 'request_sent';
          } else if (reqs.received.some(r => String(r.Sender.UserID) === String(targetUser.UserID))) {
            relationship = 'request_received';
          }
        }
      } else {
        relationship = 'self';
      }

      return res.json({
        success: true,
        user: targetUser,
        relationship
      });
    } catch (err) {
      console.error('Error getting profile:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve profile.' });
    }
  }

  /**
   * Update current user's profile
   */
  async updateProfile(req, res) {
    try {
      const { fullName, bio, location, gender, mobile, profilePicture } = req.body;
      const updates = {};

      if (fullName && fullName.trim().length >= 2) {
        updates.FullName = sanitizeString(fullName);
      }
      if (bio !== undefined) {
        updates.Bio = sanitizeString(bio);
      }
      if (location !== undefined) {
        updates.Location = sanitizeString(location);
      }
      if (gender) {
        updates.Gender = sanitizeString(gender);
      }
      if (mobile) {
        updates.Mobile = sanitizeString(mobile);
      }
      if (profilePicture) {
        updates.ProfilePicture = profilePicture;
      }

      const updatedUser = await googleSheetsService.updateUser(req.user.UserID, updates);

      return res.json({
        success: true,
        message: 'Profile updated successfully!',
        user: updatedUser
      });
    } catch (err) {
      console.error('Error updating profile:', err);
      return res.status(500).json({ success: false, error: 'Failed to update profile.' });
    }
  }

  /**
   * Search users by query
   */
  async searchUsers(req, res) {
    try {
      const query = req.query.q || '';
      if (!query.trim()) {
        return res.json({ success: true, users: [] });
      }

      const users = await googleSheetsService.searchUsers(query, req.user.UserID);
      return res.json({ success: true, users });
    } catch (err) {
      console.error('Search users error:', err);
      return res.status(500).json({ success: false, error: 'Search failed.' });
    }
  }

  /**
   * Get Random Stranger (Turn Strangers Into Friends feature)
   */
  async getRandomStranger(req, res) {
    try {
      const allUsers = await googleSheetsService.getAllUsers('', 'active');
      const friends = await googleSheetsService.getFriendsList(req.user.UserID);
      const friendIds = new Set(friends.map(f => String(f.UserID)));
      const blocked = await googleSheetsService.getBlockedUsers(req.user.UserID);
      const blockedIds = new Set(blocked.map(b => String(b.BlockedID)));

      // Strangers: active, not self, not already friend, not blocked
      const strangers = allUsers.filter(u => 
        String(u.UserID) !== String(req.user.UserID) &&
        !friendIds.has(String(u.UserID)) &&
        !blockedIds.has(String(u.UserID))
      );

      if (strangers.length === 0) {
        return res.json({
          success: true,
          stranger: null,
          message: 'No new strangers found right now. Invite your friends to join!'
        });
      }

      // Pick a random stranger
      const randomIndex = Math.floor(Math.random() * strangers.length);
      const randomStranger = strangers[randomIndex];

      return res.json({
        success: true,
        stranger: {
          UserID: randomStranger.UserID,
          FullName: randomStranger.FullName,
          Username: randomStranger.Username,
          Gender: randomStranger.Gender,
          Location: randomStranger.Location || 'Planet Earth',
          Bio: randomStranger.Bio || 'Looking to turn strangers into friends!',
          ProfilePicture: randomStranger.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(randomStranger.FullName)}&background=7c3aed&color=fff`,
          CreatedAt: randomStranger.CreatedAt
        }
      });
    } catch (err) {
      console.error('Random stranger error:', err);
      return res.status(500).json({ success: false, error: 'Failed to discover stranger.' });
    }
  }
}

module.exports = new UserController();
