/**
 * STRANGERS INTO FRIENDS - Real-Time Socket.IO Client Manager
 */

class SocketClient {
  constructor() {
    this.socket = null;
    this.callbacks = new Map();
  }

  init() {
    const token = API.getToken();
    if (!token) return;

    if (typeof io === 'undefined') {
      console.warn('Socket.IO script not loaded on page.');
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io({
      auth: { token: token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('⚡ Connected to Strangers Into Friends Real-Time Gateway.');
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });

    // Global real-time events
    this.socket.on('new_message', (data) => {
      Utils.playNotificationSound();
      
      // Dispatch custom DOM event for active chat page
      window.dispatchEvent(new CustomEvent('sif:new_message', { detail: data }));

      // If user is not on chat page, show a friendly notification toast
      if (!window.location.pathname.includes('chat')) {
        const senderName = data.sender ? data.sender.FullName : 'A friend';
        const snippet = data.message.MessageType === 'image' ? 'sent an image' : data.message.Content;
        Utils.showToast(senderName, snippet, 'info');
      }
    });

    this.socket.on('messages_read', (data) => {
      window.dispatchEvent(new CustomEvent('sif:messages_read', { detail: data }));
    });

    this.socket.on('user_typing', (data) => {
      window.dispatchEvent(new CustomEvent('sif:user_typing', { detail: data }));
    });

    this.socket.on('user_stop_typing', (data) => {
      window.dispatchEvent(new CustomEvent('sif:user_stop_typing', { detail: data }));
    });

    this.socket.on('user_status_change', (data) => {
      window.dispatchEvent(new CustomEvent('sif:user_status_change', { detail: data }));
      
      // Dynamically update any status dots with matching data-user-id
      document.querySelectorAll(`[data-user-status-id="${data.userId}"]`).forEach(el => {
        el.className = `status-dot ${data.status}`;
      });
    });

    this.socket.on('new_friend_request', (data) => {
      Utils.playNotificationSound();
      window.dispatchEvent(new CustomEvent('sif:new_friend_request', { detail: data }));
      const senderName = data.sender ? data.sender.FullName : 'A user';
      Utils.showToast('New Friend Request', `${senderName} wants to turn stranger into friend!`, 'success');
    });

    this.socket.on('account_suspended', (data) => {
      alert(data.message || 'Your account has been suspended by an administrator.');
      API.clearAuth();
      window.location.href = '/login.html';
    });
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }
}

const socketClient = new SocketClient();

document.addEventListener('DOMContentLoaded', () => {
  if (API.getToken()) {
    socketClient.init();
  }
});
