/**
 * ============================================================================
 * STRANGERS INTO FRIENDS - GOOGLE APPS SCRIPT DATABASE BACKEND
 * Tagline: "Meet Strangers. Make Friends. Share Feelings."
 * ============================================================================
 * 
 * This Apps Script serves as the exclusive permanent database bridge for the
 * Strangers Into Friends Node.js / Express backend.
 * 
 * Sheet Tabs Managed:
 *  1. Users
 *  2. Messages
 *  3. Conversations
 *  4. FriendRequests
 *  5. Friends
 *  6. Notifications
 *  7. BlockedUsers
 *  8. Reports
 *  9. Sessions
 * 10. Settings
 * ============================================================================
 */

const CONFIG = {
  // Shared API Secret Key between Node.js backend and Google Apps Script
  // Set this property in Apps Script: Project Settings -> Script Properties -> API_SECRET
  // Or fallback to default below:
  DEFAULT_API_SECRET: 'SIF_SECURE_API_SECRET_2026_CHANGE_IN_PRODUCTION',
  DB_ID_PROPERTY: 'SIF_SPREADSHEET_ID',
  MAX_MESSAGES_PER_QUERY: 100,
  SHEET_SCHEMAS: {
    Users: [
      'UserID', 'FullName', 'Username', 'Mobile', 'Email', 
      'PasswordHash', 'DateOfBirth', 'Gender', 'Bio', 'Location', 
      'ProfilePicture', 'Role', 'Status', 'CreatedAt', 'LastLogin'
    ],
    Messages: [
      'MessageID', 'ConversationID', 'SenderID', 'ReceiverID', 
      'MessageType', 'Content', 'Timestamp', 'Status', 'DeletedFor'
    ],
    Conversations: [
      'ConversationID', 'User1ID', 'User2ID', 'LastMessageID', 
      'LastMessageContent', 'LastMessageTimestamp', 'UnreadCountUser1', 
      'UnreadCountUser2', 'CreatedAt', 'UpdatedAt'
    ],
    FriendRequests: [
      'RequestID', 'SenderID', 'ReceiverID', 'Status', 'CreatedAt', 'UpdatedAt'
    ],
    Friends: [
      'FriendshipID', 'User1ID', 'User2ID', 'Status', 'CreatedAt'
    ],
    Notifications: [
      'NotificationID', 'UserID', 'Type', 'Title', 'Body', 'Link', 'IsRead', 'CreatedAt'
    ],
    BlockedUsers: [
      'BlockID', 'BlockerID', 'BlockedID', 'Reason', 'CreatedAt'
    ],
    Reports: [
      'ReportID', 'ReporterID', 'ReportedUserID', 'Reason', 'Details', 
      'Status', 'AdminNotes', 'CreatedAt', 'UpdatedAt'
    ],
    Sessions: [
      'SessionID', 'UserID', 'Token', 'IPAddress', 'UserAgent', 
      'CreatedAt', 'ExpiresAt', 'IsValid'
    ],
    Settings: [
      'Key', 'Value', 'Description', 'UpdatedAt'
    ]
  }
};

/**
 * Handle HTTP GET Requests: Health check, schema verification, and setup status
 */
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'health';
    
    if (action === 'setup') {
      const setupResult = setupDatabase();
      return jsonResponse({
        success: true,
        message: 'Database setup completed successfully.',
        details: setupResult
      });
    }

    return jsonResponse({
      success: true,
      service: 'STRANGERS INTO FRIENDS - Google Apps Script Database Bridge',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      sheets: Object.keys(CONFIG.SHEET_SCHEMAS)
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

/**
 * Handle HTTP POST Requests: Receives commands from Node.js backend
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Acquire lock for up to 30 seconds to prevent concurrent write collisions
    lock.waitLock(30000);
    
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'Empty request payload.' }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    
    // Verify API Secret
    const scriptProps = PropertiesService.getScriptProperties();
    const expectedSecret = scriptProps.getProperty('API_SECRET') || CONFIG.DEFAULT_API_SECRET;
    
    if (payload.apiSecret !== expectedSecret) {
      return jsonResponse({ success: false, error: 'Unauthorized: Invalid API Secret.' }, 401);
    }

    const action = payload.action;
    const data = payload.data || {};

    let result;
    switch (action) {
      case 'ping':
        result = { pong: true, time: new Date().toISOString() };
        break;

      case 'setupDatabase':
        result = setupDatabase();
        break;

      // User Operations
      case 'findUserByUsernameOrEmail':
        result = findUserByUsernameOrEmail_(data.identifier);
        break;
      case 'getUserById':
        result = getUserById_(data.userId, data.includePrivate);
        break;
      case 'createUser':
        result = createUser_(data);
        break;
      case 'updateUser':
        result = updateUser_(data.userId, data.updates);
        break;
      case 'searchUsers':
        result = searchUsers_(data.query, data.currentUserId);
        break;
      case 'getAllUsers':
        result = getAllUsers_(data.search, data.status);
        break;
      case 'updateUserStatus':
        result = updateUserStatus_(data.userId, data.status);
        break;
      case 'resetPassword':
        result = resetPassword_(data.userId, data.newPasswordHash);
        break;

      // Conversation & Messages Operations
      case 'getOrCreateConversation':
        result = getOrCreateConversation_(data.user1Id, data.user2Id);
        break;
      case 'getUserConversations':
        result = getUserConversations_(data.userId);
        break;
      case 'saveMessage':
        result = saveMessage_(data);
        break;
      case 'getConversationMessages':
        result = getConversationMessages_(data.conversationId, data.userId, data.limit, data.before);
        break;
      case 'markMessagesAsRead':
        result = markMessagesAsRead_(data.conversationId, data.userId);
        break;
      case 'deleteMessage':
        result = deleteMessage_(data.messageId, data.userId, data.deleteType);
        break;

      // Friend Operations
      case 'sendFriendRequest':
        result = sendFriendRequest_(data.senderId, data.receiverId);
        break;
      case 'respondFriendRequest':
        result = respondFriendRequest_(data.requestId, data.userId, data.action);
        break;
      case 'getFriendRequests':
        result = getFriendRequests_(data.userId);
        break;
      case 'getFriendsList':
        result = getFriendsList_(data.userId);
        break;
      case 'removeFriend':
        result = removeFriend_(data.userId, data.friendId);
        break;

      // Block & Report Operations
      case 'blockUser':
        result = blockUser_(data.blockerId, data.blockedId, data.reason);
        break;
      case 'unblockUser':
        result = unblockUser_(data.blockerId, data.blockedId);
        break;
      case 'getBlockedUsers':
        result = getBlockedUsers_(data.userId);
        break;
      case 'reportUser':
        result = reportUser_(data);
        break;
      case 'getAdminReports':
        result = getAdminReports_(data.status);
        break;
      case 'updateReportStatus':
        result = updateReportStatus_(data.reportId, data.status, data.adminNotes);
        break;

      // Notifications
      case 'getNotifications':
        result = getNotifications_(data.userId);
        break;
      case 'markNotificationsRead':
        result = markNotificationsRead_(data.userId, data.notificationIds);
        break;

      // Sessions
      case 'saveSession':
        result = saveSession_(data);
        break;
      case 'invalidateSession':
        result = invalidateSession_(data.token);
        break;

      // Admin & Settings
      case 'getAdminStats':
        result = getAdminStats_();
        break;
      case 'getSettings':
        result = getSettings_();
        break;
      case 'updateSetting':
        result = updateSetting_(data.key, data.value);
        break;

      default:
        throw new Error('Unsupported database action: ' + action);
    }

    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message || err.toString() }, 400);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Format JSON response for Apps Script ContentService
 */
function jsonResponse(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get active spreadsheet or open by stored ID
 */
function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(CONFIG.DB_ID_PROPERTY);
  let ss = null;
  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (e) {
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error('Spreadsheet not found. Please attach script to a Google Sheet or set SIF_SPREADSHEET_ID property.');
    }
    props.setProperty(CONFIG.DB_ID_PROPERTY, ss.getId());
  }
  return ss;
}

/**
 * Setup database: ensures all 10 tabs exist with proper column headers
 */
function setupDatabase() {
  const ss = getSpreadsheet_();
  const createdSheets = [];

  Object.keys(CONFIG.SHEET_SCHEMAS).forEach(name => {
    let sh = ss.getSheetByName(name);
    const headers = CONFIG.SHEET_SCHEMAS[name];

    if (!sh) {
      sh = ss.insertSheet(name);
      createdSheets.push(name);
    }

    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#1e2235')
        .setFontColor('#ffffff');
    }
    sh.setFrozenRows(1);
  });

  // Seed default platform settings if Settings sheet is empty (only header row)
  const settingsSheet = ss.getSheetByName('Settings');
  if (settingsSheet.getLastRow() === 1) {
    const defaultSettings = [
      ['PlatformName', 'STRANGERS INTO FRIENDS', 'The official brand name of the platform', new Date().toISOString()],
      ['Tagline', 'Meet Strangers. Make Friends. Share Feelings.', 'Public hero tagline', new Date().toISOString()],
      ['AllowRegistration', 'true', 'Enable or disable new user signups', new Date().toISOString()],
      ['MaintenanceMode', 'false', 'Enable or disable maintenance banner', new Date().toISOString()],
      ['MaxUploadSizeMB', '5', 'Maximum allowed image upload size in MB', new Date().toISOString()],
      ['Require18Plus', 'true', 'Require users to be at least 18 years old', new Date().toISOString()]
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 4).setValues(defaultSettings);
  }

  // Remove default "Sheet1" if present and unused
  const defaultSheet1 = ss.getSheetByName('Sheet1');
  if (defaultSheet1 && ss.getSheets().length > 1 && defaultSheet1.getLastRow() === 0) {
    try { ss.deleteSheet(defaultSheet1); } catch (e) {}
  }

  return {
    spreadsheetUrl: ss.getUrl(),
    spreadsheetId: ss.getId(),
    createdSheets: createdSheets,
    allSheets: Object.keys(CONFIG.SHEET_SCHEMAS)
  };
}

/**
 * Read all rows of a sheet as JavaScript objects
 */
function readAllRows_(sheetName) {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];
  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const rowObj = { _rowNum: r + 1 };
    let hasData = false;
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      const val = values[r][c];
      rowObj[header] = val;
      if (val !== '' && val !== null && val !== undefined) hasData = true;
    }
    if (hasData) rows.push(rowObj);
  }
  return rows;
}

/**
 * Append a row object to a sheet matching the schema
 */
function appendRow_(sheetName, obj) {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet not found: ' + sheetName);

  const headers = CONFIG.SHEET_SCHEMAS[sheetName];
  const rowData = headers.map(h => obj[h] !== undefined && obj[h] !== null ? obj[h] : '');
  
  sh.appendRow(rowData);
  return obj;
}

/**
 * Update row values by row number
 */
function updateRow_(sheetName, rowNum, updates) {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet not found: ' + sheetName);

  const headers = CONFIG.SHEET_SCHEMAS[sheetName];
  headers.forEach((h, colIndex) => {
    if (updates[h] !== undefined) {
      sh.getRange(rowNum, colIndex + 1).setValue(updates[h]);
    }
  });
}

/**
 * USER OPERATIONS
 */

function findUserByUsernameOrEmail_(identifier) {
  if (!identifier) return null;
  const cleanId = String(identifier).trim().toLowerCase();
  const users = readAllRows_('Users');
  
  const found = users.find(u => 
    String(u.Username).toLowerCase() === cleanId || 
    String(u.Email).toLowerCase() === cleanId
  );

  return found || null;
}

function getUserById_(userId, includePrivate) {
  const users = readAllRows_('Users');
  const user = users.find(u => String(u.UserID) === String(userId));
  if (!user) return null;

  const copy = Object.assign({}, user);
  delete copy._rowNum;
  if (!includePrivate) {
    delete copy.PasswordHash;
  }
  return copy;
}

function createUser_(data) {
  // Check uniqueness of username and email
  const existingUser = findUserByUsernameOrEmail_(data.username);
  if (existingUser) {
    throw new Error('Username or Email already registered.');
  }

  const existingEmail = findUserByUsernameOrEmail_(data.email);
  if (existingEmail) {
    throw new Error('Username or Email already registered.');
  }

  const userObj = {
    UserID: data.userId || Utilities.getUuid(),
    FullName: data.fullName,
    Username: data.username.toLowerCase(),
    Mobile: data.mobile,
    Email: data.email.toLowerCase(),
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

  appendRow_('Users', userObj);
  
  const safeUser = Object.assign({}, userObj);
  delete safeUser.PasswordHash;
  return safeUser;
}

function updateUser_(userId, updates) {
  const users = readAllRows_('Users');
  const user = users.find(u => String(u.UserID) === String(userId));
  if (!user) throw new Error('User not found.');

  const allowedUpdates = {};
  ['FullName', 'Bio', 'Location', 'Gender', 'Mobile', 'ProfilePicture', 'LastLogin'].forEach(f => {
    if (updates[f] !== undefined) allowedUpdates[f] = updates[f];
  });

  updateRow_('Users', user._rowNum, allowedUpdates);
  return getUserById_(userId, false);
}

function searchUsers_(query, currentUserId) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];

  const users = readAllRows_('Users');
  const blockedUsers = getBlockedUsers_(currentUserId);
  const blockedSet = new Set(blockedUsers.map(b => b.BlockedID));

  const results = users
    .filter(u => {
      if (String(u.UserID) === String(currentUserId)) return false;
      if (u.Status !== 'active') return false;
      if (blockedSet.has(u.UserID)) return false;
      const uName = String(u.Username).toLowerCase();
      const fName = String(u.FullName).toLowerCase();
      return uName.includes(q) || fName.includes(q);
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

  return results;
}

function getAllUsers_(search, status) {
  const users = readAllRows_('Users');
  return users
    .filter(u => {
      if (status && status !== 'all' && u.Status !== status) return false;
      if (search) {
        const s = search.toLowerCase();
        return String(u.Username).toLowerCase().includes(s) ||
               String(u.FullName).toLowerCase().includes(s) ||
               String(u.Email).toLowerCase().includes(s);
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

function updateUserStatus_(userId, status) {
  const users = readAllRows_('Users');
  const user = users.find(u => String(u.UserID) === String(userId));
  if (!user) throw new Error('User not found.');

  updateRow_('Users', user._rowNum, { Status: status });
  return { userId: userId, status: status };
}

function resetPassword_(userId, newPasswordHash) {
  const users = readAllRows_('Users');
  const user = users.find(u => String(u.UserID) === String(userId));
  if (!user) throw new Error('User not found.');

  updateRow_('Users', user._rowNum, { PasswordHash: newPasswordHash });
  return { success: true };
}

/**
 * CONVERSATION & MESSAGING OPERATIONS
 */

function generateConvId_(user1Id, user2Id) {
  const sorted = [String(user1Id), String(user2Id)].sort();
  return 'conv_' + sorted[0] + '_' + sorted[1];
}

function getOrCreateConversation_(user1Id, user2Id) {
  const convId = generateConvId_(user1Id, user2Id);
  const convs = readAllRows_('Conversations');
  let conv = convs.find(c => c.ConversationID === convId);

  if (!conv) {
    const newConv = {
      ConversationID: convId,
      User1Id: String(user1Id),
      User2Id: String(user2Id),
      LastMessageID: '',
      LastMessageContent: '',
      LastMessageTimestamp: new Date().toISOString(),
      UnreadCountUser1: 0,
      UnreadCountUser2: 0,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };
    appendRow_('Conversations', newConv);
    conv = newConv;
  }
  return conv;
}

function getUserConversations_(userId) {
  const convs = readAllRows_('Conversations');
  const userConvs = convs.filter(c => String(c.User1ID) === String(userId) || String(c.User2ID) === String(userId));
  
  // Attach partner details
  const users = readAllRows_('Users');
  const userMap = {};
  users.forEach(u => {
    userMap[u.UserID] = {
      UserID: u.UserID,
      FullName: u.FullName,
      Username: u.Username,
      ProfilePicture: u.ProfilePicture,
      Status: u.Status
    };
  });

  return userConvs.map(c => {
    const isUser1 = String(c.User1ID) === String(userId);
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

function saveMessage_(data) {
  const convId = data.conversationId || generateConvId_(data.senderId, data.receiverId);
  const convs = readAllRows_('Conversations');
  let conv = convs.find(c => c.ConversationID === convId);

  if (!conv) {
    conv = getOrCreateConversation_(data.senderId, data.receiverId);
  }

  const messageId = data.messageId || Utilities.getUuid();
  const timestamp = data.timestamp || new Date().toISOString();

  const msgObj = {
    MessageID: messageId,
    ConversationID: convId,
    SenderID: data.senderId,
    ReceiverID: data.receiverId,
    MessageType: data.messageType || 'text',
    Content: data.content,
    Timestamp: timestamp,
    Status: 'sent',
    DeletedFor: 'none'
  };

  appendRow_('Messages', msgObj);

  // Update conversation last message & unread count
  if (conv && conv._rowNum) {
    const isUser1 = String(conv.User1ID) === String(data.senderId);
    const updates = {
      LastMessageID: messageId,
      LastMessageContent: data.messageType === 'image' ? '[Image]' : data.content,
      LastMessageTimestamp: timestamp,
      UpdatedAt: timestamp
    };
    if (isUser1) {
      updates.UnreadCountUser2 = Number(conv.UnreadCountUser2 || 0) + 1;
    } else {
      updates.UnreadCountUser1 = Number(conv.UnreadCountUser1 || 0) + 1;
    }
    updateRow_('Conversations', conv._rowNum, updates);
  }

  return msgObj;
}

function getConversationMessages_(conversationId, userId, limit, before) {
  limit = limit || 50;
  const messages = readAllRows_('Messages');
  
  const filtered = messages.filter(m => {
    if (m.ConversationID !== conversationId) return false;
    // Check deleted
    if (m.DeletedFor === 'both') return false;
    if (m.DeletedFor === 'sender' && String(m.SenderID) === String(userId)) return false;
    if (m.DeletedFor === 'receiver' && String(m.ReceiverID) === String(userId)) return false;
    if (before && new Date(m.Timestamp) >= new Date(before)) return false;
    return true;
  });

  return filtered.slice(-limit);
}

function markMessagesAsRead_(conversationId, userId) {
  const ss = getSpreadsheet_();
  const msgSheet = ss.getSheetByName('Messages');
  const messages = readAllRows_('Messages');
  
  messages.forEach(m => {
    if (m.ConversationID === conversationId && String(m.ReceiverID) === String(userId) && m.Status !== 'read') {
      const statusCol = CONFIG.SHEET_SCHEMAS.Messages.indexOf('Status') + 1;
      msgSheet.getRange(m._rowNum, statusCol).setValue('read');
    }
  });

  // Reset conversation unread counter
  const convs = readAllRows_('Conversations');
  const conv = convs.find(c => c.ConversationID === conversationId);
  if (conv) {
    const isUser1 = String(conv.User1ID) === String(userId);
    const updates = {};
    if (isUser1) updates.UnreadCountUser1 = 0;
    else updates.UnreadCountUser2 = 0;
    updateRow_('Conversations', conv._rowNum, updates);
  }

  return { success: true };
}

function deleteMessage_(messageId, userId, deleteType) {
  const messages = readAllRows_('Messages');
  const msg = messages.find(m => m.MessageID === messageId);
  if (!msg) throw new Error('Message not found.');

  let newDeletedFor = msg.DeletedFor || 'none';
  if (deleteType === 'for_everyone') {
    if (String(msg.SenderID) !== String(userId)) {
      throw new Error('Only the sender can delete a message for everyone.');
    }
    newDeletedFor = 'both';
  } else {
    // Delete for me
    if (String(msg.SenderID) === String(userId)) {
      newDeletedFor = newDeletedFor === 'receiver' ? 'both' : 'sender';
    } else {
      newDeletedFor = newDeletedFor === 'sender' ? 'both' : 'receiver';
    }
  }

  updateRow_('Messages', msg._rowNum, { DeletedFor: newDeletedFor, Status: 'deleted' });
  return { success: true, messageId: messageId, deletedFor: newDeletedFor };
}

/**
 * FRIEND OPERATIONS
 */

function sendFriendRequest_(senderId, receiverId) {
  if (String(senderId) === String(receiverId)) {
    throw new Error('You cannot send a friend request to yourself.');
  }

  // Check if already friends
  const friends = getFriendsList_(senderId);
  if (friends.some(f => String(f.UserID) === String(receiverId))) {
    throw new Error('You are already friends with this user.');
  }

  // Check pending request
  const requests = readAllRows_('FriendRequests');
  const existing = requests.find(r => 
    r.Status === 'pending' &&
    ((String(r.SenderID) === String(senderId) && String(r.ReceiverID) === String(receiverId)) ||
     (String(r.SenderID) === String(receiverId) && String(r.ReceiverID) === String(senderId)))
  );

  if (existing) {
    throw new Error('A friend request is already pending between you.');
  }

  const reqObj = {
    RequestID: Utilities.getUuid(),
    SenderID: senderId,
    ReceiverID: receiverId,
    Status: 'pending',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  };

  appendRow_('FriendRequests', reqObj);

  // Send Notification to receiver
  const senderUser = getUserById_(senderId, false);
  appendRow_('Notifications', {
    NotificationID: Utilities.getUuid(),
    UserID: receiverId,
    Type: 'friend_request',
    Title: 'New Friend Request',
    Body: (senderUser ? senderUser.FullName : 'A stranger') + ' sent you a friend request!',
    Link: '/friends.html?tab=requests',
    IsRead: 'false',
    CreatedAt: new Date().toISOString()
  });

  return reqObj;
}

function respondFriendRequest_(requestId, userId, action) {
  const requests = readAllRows_('FriendRequests');
  const req = requests.find(r => r.RequestID === requestId);
  if (!req) throw new Error('Friend request not found.');

  if (String(req.ReceiverID) !== String(userId)) {
    throw new Error('Not authorized to respond to this request.');
  }

  const newStatus = action === 'accept' ? 'accepted' : 'rejected';
  updateRow_('FriendRequests', req._rowNum, { 
    Status: newStatus,
    UpdatedAt: new Date().toISOString()
  });

  if (action === 'accept') {
    // Add to Friends sheet
    const friendship = {
      FriendshipID: Utilities.getUuid(),
      User1ID: req.SenderID,
      User2ID: req.ReceiverID,
      Status: 'active',
      CreatedAt: new Date().toISOString()
    };
    appendRow_('Friends', friendship);

    // Notify original sender
    const receiverUser = getUserById_(userId, false);
    appendRow_('Notifications', {
      NotificationID: Utilities.getUuid(),
      UserID: req.SenderID,
      Type: 'request_accepted',
      Title: 'Friend Request Accepted!',
      Body: (receiverUser ? receiverUser.FullName : 'A user') + ' accepted your friend request. Say hello!',
      Link: '/chat.html',
      IsRead: 'false',
      CreatedAt: new Date().toISOString()
    });
  }

  return { success: true, status: newStatus };
}

function getFriendRequests_(userId) {
  const requests = readAllRows_('FriendRequests');
  const users = readAllRows_('Users');
  const userMap = {};
  users.forEach(u => {
    userMap[u.UserID] = {
      UserID: u.UserID,
      FullName: u.FullName,
      Username: u.Username,
      ProfilePicture: u.ProfilePicture,
      Bio: u.Bio
    };
  });

  const received = requests
    .filter(r => String(r.ReceiverID) === String(userId) && r.Status === 'pending')
    .map(r => ({
      RequestID: r.RequestID,
      Sender: userMap[r.SenderID] || { UserID: r.SenderID, FullName: 'User' },
      CreatedAt: r.CreatedAt
    }));

  const sent = requests
    .filter(r => String(r.SenderID) === String(userId) && r.Status === 'pending')
    .map(r => ({
      RequestID: r.RequestID,
      Receiver: userMap[r.ReceiverID] || { UserID: r.ReceiverID, FullName: 'User' },
      CreatedAt: r.CreatedAt
    }));

  return { received: received, sent: sent };
}

function getFriendsList_(userId) {
  const friends = readAllRows_('Friends');
  const userFriends = friends.filter(f => 
    f.Status === 'active' && 
    (String(f.User1ID) === String(userId) || String(f.User2ID) === String(userId))
  );

  const users = readAllRows_('Users');
  const userMap = {};
  users.forEach(u => {
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
    const friendId = String(f.User1ID) === String(userId) ? f.User2ID : f.User1ID;
    const friendData = userMap[friendId] || { UserID: friendId, FullName: 'Friend' };
    return Object.assign({}, friendData, {
      FriendshipID: f.FriendshipID,
      FriendSince: f.CreatedAt
    });
  });
}

function removeFriend_(userId, friendId) {
  const friends = readAllRows_('Friends');
  const friendship = friends.find(f => 
    f.Status === 'active' &&
    ((String(f.User1ID) === String(userId) && String(f.User2ID) === String(friendId)) ||
     (String(f.User1ID) === String(friendId) && String(f.User2ID) === String(userId)))
  );

  if (!friendship) throw new Error('Friendship not found.');
  updateRow_('Friends', friendship._rowNum, { Status: 'unfriended' });
  return { success: true };
}

/**
 * BLOCK & REPORT OPERATIONS
 */

function blockUser_(blockerId, blockedId, reason) {
  if (String(blockerId) === String(blockedId)) throw new Error('Cannot block yourself.');
  
  const blocked = readAllRows_('BlockedUsers');
  const existing = blocked.find(b => String(b.BlockerID) === String(blockerId) && String(b.BlockedID) === String(blockedId));
  if (existing) return { success: true, message: 'Already blocked.' };

  const blockObj = {
    BlockID: Utilities.getUuid(),
    BlockerID: blockerId,
    BlockedID: blockedId,
    Reason: reason || 'User blocked',
    CreatedAt: new Date().toISOString()
  };

  appendRow_('BlockedUsers', blockObj);
  // Also remove from friends if friend
  try {
    removeFriend_(blockerId, blockedId);
  } catch (e) {}

  return blockObj;
}

function unblockUser_(blockerId, blockedId) {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName('BlockedUsers');
  const blocked = readAllRows_('BlockedUsers');
  const target = blocked.find(b => String(b.BlockerID) === String(blockerId) && String(b.BlockedID) === String(blockedId));
  
  if (target) {
    sh.deleteRow(target._rowNum);
  }
  return { success: true };
}

function getBlockedUsers_(userId) {
  const blocked = readAllRows_('BlockedUsers');
  return blocked.filter(b => String(b.BlockerID) === String(userId));
}

function reportUser_(data) {
  const reportObj = {
    ReportID: Utilities.getUuid(),
    ReporterID: data.reporterId,
    ReportedUserID: data.reportedUserId,
    Reason: data.reason || 'Inappropriate behavior',
    Details: data.details || '',
    Status: 'pending',
    AdminNotes: '',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  };

  appendRow_('Reports', reportObj);
  return reportObj;
}

function getAdminReports_(status) {
  const reports = readAllRows_('Reports');
  const users = readAllRows_('Users');
  const userMap = {};
  users.forEach(u => {
    userMap[u.UserID] = {
      UserID: u.UserID,
      FullName: u.FullName,
      Username: u.Username,
      Email: u.Email
    };
  });

  return reports
    .filter(r => !status || status === 'all' || r.Status === status)
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

function updateReportStatus_(reportId, status, adminNotes) {
  const reports = readAllRows_('Reports');
  const report = reports.find(r => r.ReportID === reportId);
  if (!report) throw new Error('Report not found.');

  const updates = {
    Status: status,
    UpdatedAt: new Date().toISOString()
  };
  if (adminNotes !== undefined) updates.AdminNotes = adminNotes;

  updateRow_('Reports', report._rowNum, updates);
  return { success: true, reportId: reportId, status: status };
}

/**
 * NOTIFICATIONS
 */

function getNotifications_(userId) {
  const notifs = readAllRows_('Notifications');
  return notifs
    .filter(n => String(n.UserID) === String(userId))
    .slice(-30)
    .reverse();
}

function markNotificationsRead_(userId, notificationIds) {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName('Notifications');
  const notifs = readAllRows_('Notifications');

  notifs.forEach(n => {
    if (String(n.UserID) === String(userId)) {
      if (!notificationIds || notificationIds.includes(n.NotificationID)) {
        const col = CONFIG.SHEET_SCHEMAS.Notifications.indexOf('IsRead') + 1;
        sh.getRange(n._rowNum, col).setValue('true');
      }
    }
  });

  return { success: true };
}

/**
 * SESSIONS
 */

function saveSession_(data) {
  const sessionObj = {
    SessionID: Utilities.getUuid(),
    UserID: data.userId,
    Token: data.token,
    IPAddress: data.ip || '',
    UserAgent: data.userAgent || '',
    CreatedAt: new Date().toISOString(),
    ExpiresAt: data.expiresAt || new Date(Date.now() + 7 * 86400000).toISOString(),
    IsValid: 'true'
  };

  appendRow_('Sessions', sessionObj);
  return sessionObj;
}

function invalidateSession_(token) {
  const sessions = readAllRows_('Sessions');
  const s = sessions.find(row => row.Token === token);
  if (s) {
    updateRow_('Sessions', s._rowNum, { IsValid: 'false' });
  }
  return { success: true };
}

/**
 * ADMIN STATS & SETTINGS
 */

function getAdminStats_() {
  const users = readAllRows_('Users');
  const messages = readAllRows_('Messages');
  const reports = readAllRows_('Reports');

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.Status === 'active').length;
  const suspendedUsers = users.filter(u => u.Status === 'suspended').length;
  const recentLogins = users.filter(u => u.LastLogin && new Date(u.LastLogin).getTime() > oneDayAgo).length;

  const totalMessages = messages.length;
  const totalReports = reports.length;
  const pendingReports = reports.filter(r => r.Status === 'pending').length;

  return {
    totalUsers: totalUsers,
    activeUsers: activeUsers,
    suspendedUsers: suspendedUsers,
    activeLast24h: recentLogins,
    totalMessages: totalMessages,
    totalReports: totalReports,
    pendingReports: pendingReports
  };
}

function getSettings_() {
  const rows = readAllRows_('Settings');
  const map = {};
  rows.forEach(r => {
    map[r.Key] = r.Value;
  });
  return map;
}

function updateSetting_(key, value) {
  const rows = readAllRows_('Settings');
  const existing = rows.find(r => r.Key === key);
  if (existing) {
    updateRow_('Settings', existing._rowNum, {
      Value: String(value),
      UpdatedAt: new Date().toISOString()
    });
  } else {
    appendRow_('Settings', {
      Key: key,
      Value: String(value),
      Description: '',
      UpdatedAt: new Date().toISOString()
    });
  }
  return { success: true, key: key, value: value };
}
