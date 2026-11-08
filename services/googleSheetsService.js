const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Path for local database fallback / cache
const DATA_DIR = path.join(__dirname, '..', 'data');
const LOCAL_DB_PATH = path.join(DATA_DIR, 'localDatabase.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial structure for the 10 Google Sheets tabs
const INITIAL_DB = {
  Users: [],
  Messages: [],
  Conversations: [],
  FriendRequests: [],
  Friends: [],
  Notifications: [],
  BlockedUsers: [],
  Reports: [],
  Sessions: [],
  Settings: [
    { Key: 'PlatformName', Value: 'STRANGERS INTO FRIENDS', Description: 'Platform title', UpdatedAt: new Date().toISOString() },
    { Key: 'Tagline', Value: 'Meet Strangers. Make Friends. Share Feelings.', Description: 'Platform hero tagline', UpdatedAt: new Date().toISOString() },
    { Key: 'AllowRegistration', Value: 'true', Description: 'Allow new user registration', UpdatedAt: new Date().toISOString() },
    { Key: 'MaintenanceMode', Value: 'false', Description: 'Maintenance mode status', UpdatedAt: new Date().toISOString() },
    { Key: 'MaxUploadSizeMB', Value: '5', Description: 'Max image upload size', UpdatedAt: new Date().toISOString() }
  ]
};

function readLocalDb() {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(INITIAL_DB, null, 2));
      return JSON.parse(JSON.stringify(INITIAL_DB));
    }
    const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local DB, initializing fresh:', err);
    return JSON.parse(JSON.stringify(INITIAL_DB));
  }
}

function writeLocalDb(data) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing local DB:', err);
  }
}

/**
 * Google Sheets Service - Bridges Express Backend with Google Apps Script
 */
class GoogleSheetsService {
  constructor() {
    this.webAppUrl = process.env.GOOGLE_SCRIPT_WEBAPP_URL || '';
    this.apiSecret = process.env.GOOGLE_SCRIPT_API_SECRET || 'SIF_SECURE_API_SECRET_2026_CHANGE_IN_PRODUCTION';
    this.useMock = process.env.USE_LOCAL_MOCK_DB === 'true' || !this.webAppUrl || this.webAppUrl.includes('PASTE_YOUR');

    if (this.useMock) {
      console.log('⚡ [DB Notice]: Running with local storage mode. (Configure GOOGLE_SCRIPT_WEBAPP_URL in .env to connect to live Google Sheets)');
    } else {
      console.log('📊 [DB Notice]: Connected to Google Sheets via Google Apps Script Web App:', this.webAppUrl);
    }
  }

  /**
   * Send HTTP POST action to Google Apps Script Web App
   */
  async callAppsScript(action, data = {}) {
    if (this.useMock) {
      return this.executeLocalAction(action, data);
    }

    try {
      const response = await axios.post(
        this.webAppUrl,
        {
          apiSecret: this.apiSecret,
          action: action,
          data: data
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000,
          maxRedirects: 5
        }
      );

      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        const errMsg = response.data && response.data.error ? response.data.error : 'Unknown Apps Script error';
        throw new Error(errMsg);
      }
    } catch (err) {
      console.error(`⚠️ Google Apps Script request failed for action [${action}]:`, err.message);
      // Fallback to local execution if network fails
      console.log(`🔄 Falling back to local data store for action [${action}]...`);
      return this.executeLocalAction(action, data);
    }
  }

  /**
   * Local in-memory/file-based implementation matching the 10 Google Sheets tabs
   */
  executeLocalAction(action, data) {
    const db = readLocalDb();

    switch (action) {
      case 'ping':
        return { pong: true, time: new Date().toISOString(), mode: 'local' };

      case 'setupDatabase':
        return {
          spreadsheetUrl: 'Local Mock Database',
          spreadsheetId: 'local-data-store',
          allSheets: Object.keys(INITIAL_DB)
        };

      // --- USERS ---
      case 'findUserByUsernameOrEmail': {
        const identifier = String(data.identifier || '').trim().toLowerCase();
        const user = db.Users.find(
          u => String(u.Username).toLowerCase() === identifier || String(u.Email).toLowerCase() === identifier
        );
        return user ? { ...user } : null;
      }

      case 'getUserById': {
        const user = db.Users.find(u => String(u.UserID) === String(data.userId));
        if (!user) return null;
        const copy = { ...user };
        if (!data.includePrivate) delete copy.PasswordHash;
        return copy;
      }

      case 'createUser': {
        const usernameClean = String(data.username).trim().toLowerCase();
        const emailClean = String(data.email).trim().toLowerCase();

        const exists = db.Users.find(
          u => String(u.Username).toLowerCase() === usernameClean || String(u.Email).toLowerCase() === emailClean
        );
        if (exists) throw new Error('Username or Email already registered.');

        const newUser = {
          UserID: data.userId || uuidv4(),
          FullName: data.fullName,
          Username: usernameClean,
          Mobile: data.mobile,
          Email: emailClean,
          PasswordHash: data.passwordHash,
          DateOfBirth: data.dateOfBirth,
          Gender: data.gender || 'Not specified',
          Bio: data.bio || 'Hey there! I am using Strangers Into Friends.',
          Location: data.location || '',
          ProfilePicture: data.profilePicture || '',
          Role: data.role || 'user',
          Status: 'active',
          CreatedAt: new Date().toISOString(),
          LastLogin: new Date().toISOString()
        };

        db.Users.push(newUser);
        writeLocalDb(db);

        const safeUser = { ...newUser };
        delete safeUser.PasswordHash;
        return safeUser;
      }

      case 'updateUser': {
        const userIndex = db.Users.findIndex(u => String(u.UserID) === String(data.userId));
        if (userIndex === -1) throw new Error('User not found.');

        const allowed = ['FullName', 'Bio', 'Location', 'Gender', 'Mobile', 'ProfilePicture', 'LastLogin'];
        allowed.forEach(f => {
          if (data.updates[f] !== undefined) db.Users[userIndex][f] = data.updates[f];
        });

        writeLocalDb(db);
        const safe = { ...db.Users[userIndex] };
        delete safe.PasswordHash;
        return safe;
      }

      case 'searchUsers': {
        const q = String(data.query || '').trim().toLowerCase();
        if (!q) return [];
        const blocked = (db.BlockedUsers || []).filter(b => String(b.BlockerID) === String(data.currentUserId));
        const blockedSet = new Set(blocked.map(b => b.BlockedID));

        return db.Users
          .filter(u => {
            if (String(u.UserID) === String(data.currentUserId)) return false;
            if (u.Status !== 'active') return false;
            if (blockedSet.has(u.UserID)) return false;
            return u.Username.toLowerCase().includes(q) || u.FullName.toLowerCase().includes(q);
          })
          .slice(0, 20)
          .map(u => ({
            UserID: u.UserID,
            FullName: u.FullName,
            Username: u.Username,
            Gender: u.Gender,
            Bio: u.Bio,
            Location: u.Location,
            ProfilePicture: u.ProfilePicture,
            CreatedAt: u.CreatedAt
          }));
      }

      case 'getAllUsers': {
        return db.Users
          .filter(u => {
            if (data.status && data.status !== 'all' && u.Status !== data.status) return false;
            if (data.search) {
              const s = data.search.toLowerCase();
              return u.Username.toLowerCase().includes(s) ||
                     u.FullName.toLowerCase().includes(s) ||
                     u.Email.toLowerCase().includes(s);
            }
            return true;
          })
          .map(u => ({
            UserID: u.UserID,
            FullName: u.FullName,
            Username: u.Username,
            Email: u.Email,
            Mobile: u.Mobile,
            Role: u.Role,
            Status: u.Status,
            DateOfBirth: u.DateOfBirth,
            Gender: u.Gender,
            CreatedAt: u.CreatedAt,
            LastLogin: u.LastLogin
          }));
      }

      case 'updateUserStatus': {
        const userIndex = db.Users.findIndex(u => String(u.UserID) === String(data.userId));
        if (userIndex === -1) throw new Error('User not found.');
        db.Users[userIndex].Status = data.status;
        writeLocalDb(db);
        return { userId: data.userId, status: data.status };
      }

      case 'resetPassword': {
        const userIndex = db.Users.findIndex(u => String(u.UserID) === String(data.userId));
        if (userIndex === -1) throw new Error('User not found.');
        db.Users[userIndex].PasswordHash = data.newPasswordHash;
        writeLocalDb(db);
        return { success: true };
      }

      // --- CONVERSATIONS & MESSAGES ---
      case 'getOrCreateConversation': {
        const sorted = [String(data.user1Id), String(data.user2Id)].sort();
        const convId = 'conv_' + sorted[0] + '_' + sorted[1];
        let conv = db.Conversations.find(c => c.ConversationID === convId);

        if (!conv) {
          conv = {
            ConversationID: convId,
            User1ID: sorted[0],
            User2ID: sorted[1],
            LastMessageID: '',
            LastMessageContent: '',
            LastMessageTimestamp: new Date().toISOString(),
            UnreadCountUser1: 0,
            UnreadCountUser2: 0,
            CreatedAt: new Date().toISOString(),
            UpdatedAt: new Date().toISOString()
          };
          db.Conversations.push(conv);
          writeLocalDb(db);
        }
        return conv;
      }

      case 'getUserConversations': {
        const userConvs = db.Conversations.filter(
          c => String(c.User1ID) === String(data.userId) || String(c.User2ID) === String(data.userId)
        );

        const userMap = {};
        db.Users.forEach(u => {
          userMap[u.UserID] = {
            UserID: u.UserID,
            FullName: u.FullName,
            Username: u.Username,
            ProfilePicture: u.ProfilePicture,
            Status: u.Status
          };
        });

        return userConvs.map(c => {
          const isUser1 = String(c.User1ID) === String(data.userId);
          const partnerId = isUser1 ? c.User2ID : c.User1ID;
          const partner = userMap[partnerId] || { UserID: partnerId, FullName: 'Unknown', Username: 'unknown' };
          const unread = isUser1 ? Number(c.UnreadCountUser1 || 0) : Number(c.UnreadCountUser2 || 0);

          return {
            ConversationID: c.ConversationID,
            partner: partner,
            LastMessageID: c.LastMessageID,
            LastMessageContent: c.LastMessageContent,
            LastMessageTimestamp: c.LastMessageTimestamp,
            unreadCount: unread,
            UpdatedAt: c.UpdatedAt
          };
        }).sort((a, b) => new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime());
      }

      case 'saveMessage': {
        const sorted = [String(data.senderId), String(data.receiverId)].sort();
        const convId = data.conversationId || ('conv_' + sorted[0] + '_' + sorted[1]);
        const msgId = data.messageId || uuidv4();
        const timestamp = data.timestamp || new Date().toISOString();

        const msgObj = {
          MessageID: msgId,
          ConversationID: convId,
          SenderID: data.senderId,
          ReceiverID: data.receiverId,
          MessageType: data.messageType || 'text',
          Content: data.content,
          Timestamp: timestamp,
          Status: 'sent',
          DeletedFor: 'none'
        };

        db.Messages.push(msgObj);

        let conv = db.Conversations.find(c => c.ConversationID === convId);
        if (!conv) {
          conv = {
            ConversationID: convId,
            User1ID: sorted[0],
            User2ID: sorted[1],
            LastMessageID: msgId,
            LastMessageContent: data.messageType === 'image' ? '[Image]' : data.content,
            LastMessageTimestamp: timestamp,
            UnreadCountUser1: sorted[0] === data.receiverId ? 1 : 0,
            UnreadCountUser2: sorted[1] === data.receiverId ? 1 : 0,
            CreatedAt: timestamp,
            UpdatedAt: timestamp
          };
          db.Conversations.push(conv);
        } else {
          conv.LastMessageID = msgId;
          conv.LastMessageContent = data.messageType === 'image' ? '[Image]' : data.content;
          conv.LastMessageTimestamp = timestamp;
          conv.UpdatedAt = timestamp;
          if (String(conv.User1ID) === String(data.receiverId)) {
            conv.UnreadCountUser1 = Number(conv.UnreadCountUser1 || 0) + 1;
          } else {
            conv.UnreadCountUser2 = Number(conv.UnreadCountUser2 || 0) + 1;
          }
        }

        writeLocalDb(db);
        return msgObj;
      }

      case 'getConversationMessages': {
        const limit = data.limit || 50;
        const filtered = db.Messages.filter(m => {
          if (m.ConversationID !== data.conversationId) return false;
          if (m.DeletedFor === 'both') return false;
          if (m.DeletedFor === 'sender' && String(m.SenderID) === String(data.userId)) return false;
          if (m.DeletedFor === 'receiver' && String(m.ReceiverID) === String(data.userId)) return false;
          if (data.before && new Date(m.Timestamp) >= new Date(data.before)) return false;
          return true;
        });
        return filtered.slice(-limit);
      }

      case 'markMessagesAsRead': {
        db.Messages.forEach(m => {
          if (m.ConversationID === data.conversationId && String(m.ReceiverID) === String(data.userId)) {
            m.Status = 'read';
          }
        });

        const conv = db.Conversations.find(c => c.ConversationID === data.conversationId);
        if (conv) {
          if (String(conv.User1ID) === String(data.userId)) conv.UnreadCountUser1 = 0;
          else conv.UnreadCountUser2 = 0;
        }

        writeLocalDb(db);
        return { success: true };
      }

      case 'deleteMessage': {
        const msg = db.Messages.find(m => m.MessageID === data.messageId);
        if (!msg) throw new Error('Message not found.');

        let newDeletedFor = msg.DeletedFor || 'none';
        if (data.deleteType === 'for_everyone') {
          if (String(msg.SenderID) !== String(data.userId)) {
            throw new Error('Only the sender can delete a message for everyone.');
          }
          newDeletedFor = 'both';
        } else {
          if (String(msg.SenderID) === String(data.userId)) {
            newDeletedFor = newDeletedFor === 'receiver' ? 'both' : 'sender';
          } else {
            newDeletedFor = newDeletedFor === 'sender' ? 'both' : 'receiver';
          }
        }

        msg.DeletedFor = newDeletedFor;
        msg.Status = 'deleted';
        writeLocalDb(db);
        return { success: true, messageId: data.messageId, deletedFor: newDeletedFor };
      }

      // --- FRIENDS & REQUESTS ---
      case 'sendFriendRequest': {
        if (String(data.senderId) === String(data.receiverId)) {
          throw new Error('Cannot send friend request to yourself.');
        }

        const isFriend = db.Friends.some(
          f => f.Status === 'active' &&
          ((String(f.User1ID) === String(data.senderId) && String(f.User2ID) === String(data.receiverId)) ||
           (String(f.User1ID) === String(data.receiverId) && String(f.User2ID) === String(data.senderId)))
        );
        if (isFriend) throw new Error('You are already friends with this user.');

        const pending = db.FriendRequests.find(
          r => r.Status === 'pending' &&
          ((String(r.SenderID) === String(data.senderId) && String(r.ReceiverID) === String(data.receiverId)) ||
           (String(r.SenderID) === String(data.receiverId) && String(r.ReceiverID) === String(data.senderId)))
        );
        if (pending) throw new Error('A friend request is already pending between you.');

        const reqObj = {
          RequestID: uuidv4(),
          SenderID: data.senderId,
          ReceiverID: data.receiverId,
          Status: 'pending',
          CreatedAt: new Date().toISOString(),
          UpdatedAt: new Date().toISOString()
        };
        db.FriendRequests.push(reqObj);

        // Add Notification
        const senderUser = db.Users.find(u => String(u.UserID) === String(data.senderId));
        db.Notifications.push({
          NotificationID: uuidv4(),
          UserID: data.receiverId,
          Type: 'friend_request',
          Title: 'New Friend Request',
          Body: (senderUser ? senderUser.FullName : 'A user') + ' sent you a friend request!',
          Link: '/friends.html?tab=requests',
          IsRead: 'false',
          CreatedAt: new Date().toISOString()
        });

        writeLocalDb(db);
        return reqObj;
      }

      case 'respondFriendRequest': {
        const req = db.FriendRequests.find(r => r.RequestID === data.requestId);
        if (!req) throw new Error('Friend request not found.');
        if (String(req.ReceiverID) !== String(data.userId)) {
          throw new Error('Not authorized to respond to this request.');
        }

        const newStatus = data.action === 'accept' ? 'accepted' : 'rejected';
        req.Status = newStatus;
        req.UpdatedAt = new Date().toISOString();

        if (data.action === 'accept') {
          db.Friends.push({
            FriendshipID: uuidv4(),
            User1ID: req.SenderID,
            User2ID: req.ReceiverID,
            Status: 'active',
            CreatedAt: new Date().toISOString()
          });

          const receiverUser = db.Users.find(u => String(u.UserID) === String(data.userId));
          db.Notifications.push({
            NotificationID: uuidv4(),
            UserID: req.SenderID,
            Type: 'request_accepted',
            Title: 'Friend Request Accepted!',
            Body: (receiverUser ? receiverUser.FullName : 'A user') + ' accepted your friend request. Say hello!',
            Link: '/chat.html',
            IsRead: 'false',
            CreatedAt: new Date().toISOString()
          });
        }

        writeLocalDb(db);
        return { success: true, status: newStatus };
      }

      case 'getFriendRequests': {
        const userMap = {};
        db.Users.forEach(u => {
          userMap[u.UserID] = {
            UserID: u.UserID,
            FullName: u.FullName,
            Username: u.Username,
            ProfilePicture: u.ProfilePicture,
            Bio: u.Bio
          };
        });

        const received = db.FriendRequests
          .filter(r => String(r.ReceiverID) === String(data.userId) && r.Status === 'pending')
          .map(r => ({
            RequestID: r.RequestID,
            Sender: userMap[r.SenderID] || { UserID: r.SenderID, FullName: 'User' },
            CreatedAt: r.CreatedAt
          }));

        const sent = db.FriendRequests
          .filter(r => String(r.SenderID) === String(data.userId) && r.Status === 'pending')
          .map(r => ({
            RequestID: r.RequestID,
            Receiver: userMap[r.ReceiverID] || { UserID: r.ReceiverID, FullName: 'User' },
            CreatedAt: r.CreatedAt
          }));

        return { received, sent };
      }

      case 'getFriendsList': {
        const userFriends = db.Friends.filter(
          f => f.Status === 'active' &&
          (String(f.User1ID) === String(data.userId) || String(f.User2ID) === String(data.userId))
        );

        const userMap = {};
        db.Users.forEach(u => {
          userMap[u.UserID] = {
            UserID: u.UserID,
            FullName: u.FullName,
            Username: u.Username,
            Gender: u.Gender,
            Bio: u.Bio,
            Location: u.Location,
            ProfilePicture: u.ProfilePicture,
            Status: u.Status,
            CreatedAt: u.CreatedAt
          };
        });

        return userFriends.map(f => {
          const friendId = String(f.User1ID) === String(data.userId) ? f.User2ID : f.User1ID;
          const friendData = userMap[friendId] || { UserID: friendId, FullName: 'Friend' };
          return {
            ...friendData,
            FriendshipID: f.FriendshipID,
            FriendSince: f.CreatedAt
          };
        });
      }

      case 'removeFriend': {
        const friendship = db.Friends.find(
          f => f.Status === 'active' &&
          ((String(f.User1ID) === String(data.userId) && String(f.User2ID) === String(data.friendId)) ||
           (String(f.User1ID) === String(data.friendId) && String(f.User2ID) === String(data.userId)))
        );

        if (!friendship) throw new Error('Friendship not found.');
        friendship.Status = 'unfriended';
        writeLocalDb(db);
        return { success: true };
      }

      // --- BLOCKS & REPORTS ---
      case 'blockUser': {
        if (String(data.blockerId) === String(data.blockedId)) throw new Error('Cannot block yourself.');
        const exists = db.BlockedUsers.find(
          b => String(b.BlockerID) === String(data.blockerId) && String(b.BlockedID) === String(data.blockedId)
        );
        if (exists) return { success: true, message: 'Already blocked.' };

        const blockObj = {
          BlockID: uuidv4(),
          BlockerID: data.blockerId,
          BlockedID: data.blockedId,
          Reason: data.reason || 'User blocked',
          CreatedAt: new Date().toISOString()
        };
        db.BlockedUsers.push(blockObj);

        // Also remove friendship if exists
        const fr = db.Friends.find(
          f => f.Status === 'active' &&
          ((String(f.User1ID) === String(data.blockerId) && String(f.User2ID) === String(data.blockedId)) ||
           (String(f.User1ID) === String(data.blockedId) && String(f.User2ID) === String(data.blockerId)))
        );
        if (fr) fr.Status = 'unfriended';

        writeLocalDb(db);
        return blockObj;
      }

      case 'unblockUser': {
        db.BlockedUsers = db.BlockedUsers.filter(
          b => !(String(b.BlockerID) === String(data.blockerId) && String(b.BlockedID) === String(data.blockedId))
        );
        writeLocalDb(db);
        return { success: true };
      }

      case 'getBlockedUsers': {
        return db.BlockedUsers.filter(b => String(b.BlockerID) === String(data.userId));
      }

      case 'reportUser': {
        const reportObj = {
          ReportID: uuidv4(),
          ReporterID: data.reporterId,
          ReportedUserID: data.reportedUserId,
          Reason: data.reason || 'Inappropriate behavior',
          Details: data.details || '',
          Status: 'pending',
          AdminNotes: '',
          CreatedAt: new Date().toISOString(),
          UpdatedAt: new Date().toISOString()
        };
        db.Reports.push(reportObj);
        writeLocalDb(db);
        return reportObj;
      }

      case 'getAdminReports': {
        const userMap = {};
        db.Users.forEach(u => {
          userMap[u.UserID] = {
            UserID: u.UserID,
            FullName: u.FullName,
            Username: u.Username,
            Email: u.Email
          };
        });

        return db.Reports
          .filter(r => !data.status || data.status === 'all' || r.Status === data.status)
          .map(r => ({
            ReportID: r.ReportID,
            Reporter: userMap[r.ReporterID] || { UserID: r.ReporterID, FullName: 'Reporter' },
            ReportedUser: userMap[r.ReportedUserID] || { UserID: r.ReportedUserID, FullName: 'Reported User' },
            Reason: r.Reason,
            Details: r.Details,
            Status: r.Status,
            AdminNotes: r.AdminNotes,
            CreatedAt: r.CreatedAt,
            UpdatedAt: r.UpdatedAt
          }))
          .reverse();
      }

      case 'updateReportStatus': {
        const report = db.Reports.find(r => r.ReportID === data.reportId);
        if (!report) throw new Error('Report not found.');
        report.Status = data.status;
        report.UpdatedAt = new Date().toISOString();
        if (data.adminNotes !== undefined) report.AdminNotes = data.adminNotes;
        writeLocalDb(db);
        return { success: true, reportId: data.reportId, status: data.status };
      }

      // --- NOTIFICATIONS ---
      case 'getNotifications': {
        return db.Notifications
          .filter(n => String(n.UserID) === String(data.userId))
          .slice(-30)
          .reverse();
      }

      case 'markNotificationsRead': {
        db.Notifications.forEach(n => {
          if (String(n.UserID) === String(data.userId)) {
            if (!data.notificationIds || data.notificationIds.includes(n.NotificationID)) {
              n.IsRead = 'true';
            }
          }
        });
        writeLocalDb(db);
        return { success: true };
      }

      // --- SESSIONS ---
      case 'saveSession': {
        const sessionObj = {
          SessionID: uuidv4(),
          UserID: data.userId,
          Token: data.token,
          IPAddress: data.ip || '',
          UserAgent: data.userAgent || '',
          CreatedAt: new Date().toISOString(),
          ExpiresAt: data.expiresAt || new Date(Date.now() + 7 * 86400000).toISOString(),
          IsValid: 'true'
        };
        db.Sessions.push(sessionObj);
        writeLocalDb(db);
        return sessionObj;
      }

      case 'invalidateSession': {
        const s = db.Sessions.find(row => row.Token === data.token);
        if (s) s.IsValid = 'false';
        writeLocalDb(db);
        return { success: true };
      }

      // --- ADMIN STATS & SETTINGS ---
      case 'getAdminStats': {
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        const totalUsers = db.Users.length;
        const activeUsers = db.Users.filter(u => u.Status === 'active').length;
        const suspendedUsers = db.Users.filter(u => u.Status === 'suspended').length;
        const recentLogins = db.Users.filter(u => u.LastLogin && new Date(u.LastLogin).getTime() > oneDayAgo).length;
        const totalMessages = db.Messages.length;
        const totalReports = db.Reports.length;
        const pendingReports = db.Reports.filter(r => r.Status === 'pending').length;

        return {
          totalUsers,
          activeUsers,
          suspendedUsers,
          activeLast24h: recentLogins,
          totalMessages,
          totalReports,
          pendingReports
        };
      }

      case 'getSettings': {
        const map = {};
        db.Settings.forEach(r => {
          map[r.Key] = r.Value;
        });
        return map;
      }

      case 'updateSetting': {
        const existing = db.Settings.find(r => r.Key === data.key);
        if (existing) {
          existing.Value = String(data.value);
          existing.UpdatedAt = new Date().toISOString();
        } else {
          db.Settings.push({
            Key: data.key,
            Value: String(data.value),
            Description: '',
            UpdatedAt: new Date().toISOString()
          });
        }
        writeLocalDb(db);
        return { success: true, key: data.key, value: data.value };
      }

      default:
        throw new Error('Unknown local action: ' + action);
    }
  }

  // Helper convenience methods wrapped over callAppsScript
  async findUserByUsernameOrEmail(identifier) {
    return this.callAppsScript('findUserByUsernameOrEmail', { identifier });
  }

  async getUserById(userId, includePrivate = false) {
    return this.callAppsScript('getUserById', { userId, includePrivate });
  }

  async createUser(userData) {
    return this.callAppsScript('createUser', userData);
  }

  async updateUser(userId, updates) {
    return this.callAppsScript('updateUser', { userId, updates });
  }

  async searchUsers(query, currentUserId) {
    return this.callAppsScript('searchUsers', { query, currentUserId });
  }

  async getAllUsers(search, status) {
    return this.callAppsScript('getAllUsers', { search, status });
  }

  async updateUserStatus(userId, status) {
    return this.callAppsScript('updateUserStatus', { userId, status });
  }

  async resetPassword(userId, newPasswordHash) {
    return this.callAppsScript('resetPassword', { userId, newPasswordHash });
  }

  async getOrCreateConversation(user1Id, user2Id) {
    return this.callAppsScript('getOrCreateConversation', { user1Id, user2Id });
  }

  async getUserConversations(userId) {
    return this.callAppsScript('getUserConversations', { userId });
  }

  async saveMessage(messageData) {
    return this.callAppsScript('saveMessage', messageData);
  }

  async getConversationMessages(conversationId, userId, limit = 50, before = null) {
    return this.callAppsScript('getConversationMessages', { conversationId, userId, limit, before });
  }

  async markMessagesAsRead(conversationId, userId) {
    return this.callAppsScript('markMessagesAsRead', { conversationId, userId });
  }

  async deleteMessage(messageId, userId, deleteType) {
    return this.callAppsScript('deleteMessage', { messageId, userId, deleteType });
  }

  async sendFriendRequest(senderId, receiverId) {
    return this.callAppsScript('sendFriendRequest', { senderId, receiverId });
  }

  async respondFriendRequest(requestId, userId, action) {
    return this.callAppsScript('respondFriendRequest', { requestId, userId, action });
  }

  async getFriendRequests(userId) {
    return this.callAppsScript('getFriendRequests', { userId });
  }

  async getFriendsList(userId) {
    return this.callAppsScript('getFriendsList', { userId });
  }

  async removeFriend(userId, friendId) {
    return this.callAppsScript('removeFriend', { userId, friendId });
  }

  async blockUser(blockerId, blockedId, reason) {
    return this.callAppsScript('blockUser', { blockerId, blockedId, reason });
  }

  async unblockUser(blockerId, blockedId) {
    return this.callAppsScript('unblockUser', { blockerId, blockedId });
  }

  async getBlockedUsers(userId) {
    return this.callAppsScript('getBlockedUsers', { userId });
  }

  async reportUser(reportData) {
    return this.callAppsScript('reportUser', reportData);
  }

  async getAdminReports(status) {
    return this.callAppsScript('getAdminReports', { status });
  }

  async updateReportStatus(reportId, status, adminNotes) {
    return this.callAppsScript('updateReportStatus', { reportId, status, adminNotes });
  }

  async getNotifications(userId) {
    return this.callAppsScript('getNotifications', { userId });
  }

  async markNotificationsRead(userId, notificationIds) {
    return this.callAppsScript('markNotificationsRead', { userId, notificationIds });
  }

  async saveSession(sessionData) {
    return this.callAppsScript('saveSession', sessionData);
  }

  async invalidateSession(token) {
    return this.callAppsScript('invalidateSession', { token });
  }

  async getAdminStats() {
    return this.callAppsScript('getAdminStats', {});
  }

  async getSettings() {
    return this.callAppsScript('getSettings', {});
  }

  async updateSetting(key, value) {
    return this.callAppsScript('updateSetting', { key, value });
  }
}

module.exports = new GoogleSheetsService();
