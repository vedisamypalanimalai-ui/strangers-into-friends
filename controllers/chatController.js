const { v4: uuidv4 } = require('uuid');
const googleSheetsService = require('../services/googleSheetsService');
const socketService = require('../services/socketService');

class ChatController {
  /**
   * Get all conversations for current user
   */
  async getConversations(req, res) {
    try {
      const conversations = await googleSheetsService.getUserConversations(req.user.UserID);

      // Annotate partner online status
      const decorated = conversations.map(c => ({
        ...c,
        partner: {
          ...c.partner,
          isOnline: socketService.isUserOnline(c.partner.UserID)
        }
      }));

      return res.json({ success: true, conversations: decorated });
    } catch (err) {
      console.error('Error getting conversations:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch conversations.' });
    }
  }

  /**
   * Get or start conversation with a user
   */
  async startConversation(req, res) {
    try {
      const { partnerId } = req.body;
      if (!partnerId) {
        return res.status(400).json({ success: false, error: 'Partner ID is required.' });
      }

      if (String(partnerId) === String(req.user.UserID)) {
        return res.status(400).json({ success: false, error: 'Cannot start conversation with yourself.' });
      }

      // Check if blocked
      const blocked = await googleSheetsService.getBlockedUsers(req.user.UserID);
      if (blocked.some(b => String(b.BlockedID) === String(partnerId))) {
        return res.status(403).json({ success: false, error: 'Cannot message a blocked user. Unblock them first.' });
      }

      const partner = await googleSheetsService.getUserById(partnerId, false);
      if (!partner) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      const conv = await googleSheetsService.getOrCreateConversation(req.user.UserID, partnerId);
      return res.json({
        success: true,
        conversation: {
          ...conv,
          partner: {
            ...partner,
            isOnline: socketService.isUserOnline(partner.UserID)
          }
        }
      });
    } catch (err) {
      console.error('Error starting conversation:', err);
      return res.status(500).json({ success: false, error: 'Failed to start conversation.' });
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { limit, before } = req.query;

      if (!conversationId) {
        return res.status(400).json({ success: false, error: 'Conversation ID is required.' });
      }

      // Authorization check: verify current user is a participant
      const parts = conversationId.replace('conv_', '').split('_');
      if (parts.length === 2 && !parts.includes(String(req.user.UserID))) {
        return res.status(403).json({ success: false, error: 'Unauthorized to view this conversation.' });
      }

      const messages = await googleSheetsService.getConversationMessages(
        conversationId,
        req.user.UserID,
        parseInt(limit) || 50,
        before || null
      );

      // Auto mark messages as read for this conversation
      await googleSheetsService.markMessagesAsRead(conversationId, req.user.UserID);

      // Find partner ID to notify
      const partnerId = parts[0] === String(req.user.UserID) ? parts[1] : parts[0];
      if (partnerId) {
        socketService.emitToUser(partnerId, 'messages_read', {
          conversationId,
          readerId: req.user.UserID
        });
      }

      return res.json({ success: true, messages });
    } catch (err) {
      console.error('Error getting messages:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch messages.' });
    }
  }

  /**
   * Send a new message
   */
  async sendMessage(req, res) {
    try {
      const { receiverId, conversationId, content, messageType } = req.body;

      if (!receiverId || !content) {
        return res.status(400).json({ success: false, error: 'Receiver ID and content are required.' });
      }

      // Check if blocked by either party
      const myBlocks = await googleSheetsService.getBlockedUsers(req.user.UserID);
      if (myBlocks.some(b => String(b.BlockedID) === String(receiverId))) {
        return res.status(403).json({ success: false, error: 'You have blocked this user.' });
      }

      const receiverBlocks = await googleSheetsService.getBlockedUsers(receiverId);
      if (receiverBlocks.some(b => String(b.BlockedID) === String(req.user.UserID))) {
        return res.status(403).json({ success: false, error: 'You cannot send messages to this user.' });
      }

      const messageObj = {
        messageId: uuidv4(),
        conversationId: conversationId || undefined,
        senderId: req.user.UserID,
        receiverId: receiverId,
        messageType: messageType || 'text',
        content: content,
        timestamp: new Date().toISOString()
      };

      // Persistent save to Google Sheets Messages tab
      const savedMessage = await googleSheetsService.saveMessage(messageObj);

      // Real-time delivery via Socket.IO
      socketService.emitToUser(receiverId, 'new_message', {
        message: savedMessage,
        sender: {
          UserID: req.user.UserID,
          FullName: req.user.FullName,
          Username: req.user.Username,
          ProfilePicture: req.user.ProfilePicture
        }
      });

      // Echo back to sender's other tabs/sockets
      socketService.emitToUser(req.user.UserID, 'message_sent', {
        message: savedMessage
      });

      return res.status(201).json({ success: true, message: savedMessage });
    } catch (err) {
      console.error('Error sending message:', err);
      return res.status(500).json({ success: false, error: 'Failed to send message.' });
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { deleteType } = req.body; // 'for_me' or 'for_everyone'

      const result = await googleSheetsService.deleteMessage(messageId, req.user.UserID, deleteType || 'for_me');

      // If deleted for everyone, notify recipient via socket
      if (deleteType === 'for_everyone' && req.body.receiverId) {
        socketService.emitToUser(req.body.receiverId, 'message_deleted', {
          messageId: messageId,
          conversationId: req.body.conversationId
        });
      }

      return res.json({ success: true, result });
    } catch (err) {
      console.error('Error deleting message:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to delete message.' });
    }
  }

  /**
   * Handle image upload for chat
   */
  async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file uploaded.' });
      }

      const imageUrl = `/uploads/${req.file.filename}`;
      return res.json({
        success: true,
        imageUrl: imageUrl,
        filename: req.file.filename
      });
    } catch (err) {
      console.error('Image upload error:', err);
      return res.status(500).json({ success: false, error: 'Image upload failed.' });
    }
  }
}

module.exports = new ChatController();
