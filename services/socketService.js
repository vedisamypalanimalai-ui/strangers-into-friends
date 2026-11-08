const jwt = require('jsonwebtoken');
const googleSheetsService = require('./googleSheetsService');

const JWT_SECRET = process.env.JWT_SECRET || 'sif_jwt_super_secret_key_8f3d9a1c6e4b2d7e_2026';

class SocketService {
  constructor() {
    this.io = null;
    // Map of userId -> Set of socket IDs
    this.userSockets = new Map();
    // Map of socketId -> userId
    this.socketToUser = new Map();
  }

  init(io) {
    this.io = io;

    // Authentication middleware for Socket.IO
    this.io.use(async (socket, next) => {
      try {
        let token = socket.handshake.auth && socket.handshake.auth.token;
        if (!token && socket.handshake.headers && socket.handshake.headers.cookie) {
          const cookieMatch = socket.handshake.headers.cookie.match(/sif_token=([^;]+)/);
          if (cookieMatch) token = cookieMatch[1];
        }

        if (!token) {
          return next(new Error('Authentication required for socket connection.'));
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        next();
      } catch (err) {
        return next(new Error('Invalid socket authentication token.'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('🔌 Socket.IO Service initialized successfully.');
  }

  handleConnection(socket) {
    const userId = socket.userId;
    if (!userId) return;

    // Register socket
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);
    this.socketToUser.set(socket.id, userId);

    // Join personal room
    socket.join(`user_${userId}`);

    // Broadcast user online status
    this.io.emit('user_status_change', {
      userId: userId,
      status: 'online'
    });

    // Handle typing indicator
    socket.on('typing_start', (data) => {
      if (data && data.recipientId) {
        this.emitToUser(data.recipientId, 'user_typing', {
          senderId: userId,
          conversationId: data.conversationId
        });
      }
    });

    socket.on('typing_stop', (data) => {
      if (data && data.recipientId) {
        this.emitToUser(data.recipientId, 'user_stop_typing', {
          senderId: userId,
          conversationId: data.conversationId
        });
      }
    });

    // Handle read receipt
    socket.on('mark_read', async (data) => {
      if (data && data.conversationId && data.partnerId) {
        try {
          await googleSheetsService.markMessagesAsRead(data.conversationId, userId);
          this.emitToUser(data.partnerId, 'messages_read', {
            conversationId: data.conversationId,
            readerId: userId
          });
        } catch (e) {
          console.error('Error handling mark_read socket event:', e);
        }
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      const userSocketsSet = this.userSockets.get(userId);
      if (userSocketsSet) {
        userSocketsSet.delete(socket.id);
        if (userSocketsSet.size === 0) {
          this.userSockets.delete(userId);
          // Broadcast offline status
          this.io.emit('user_status_change', {
            userId: userId,
            status: 'offline'
          });
        }
      }
      this.socketToUser.delete(socket.id);
    });
  }

  /**
   * Emit an event directly to a specific user's active sockets
   */
  emitToUser(userId, event, data) {
    if (!this.io) return;
    this.io.to(`user_${userId}`).emit(event, data);
  }

  /**
   * Emit an event to all connected users
   */
  emitToAll(event, data) {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  /**
   * Check if user is currently online
   */
  isUserOnline(userId) {
    const sockets = this.userSockets.get(String(userId));
    return !!(sockets && sockets.size > 0);
  }

  /**
   * Get all currently online user IDs
   */
  getOnlineUserIds() {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Get count of online users
   */
  getOnlineCount() {
    return this.userSockets.size;
  }
}

module.exports = new SocketService();
