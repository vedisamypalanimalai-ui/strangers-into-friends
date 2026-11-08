/**
 * STRANGERS INTO FRIENDS - Unified API Client
 */

const API = {
  getToken() {
    return localStorage.getItem('sif_token') || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('sif_token', token);
    } else {
      localStorage.removeItem('sif_token');
    }
  },

  getCurrentUser() {
    try {
      const raw = localStorage.getItem('sif_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem('sif_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sif_user');
    }
  },

  clearAuth() {
    localStorage.removeItem('sif_token');
    localStorage.removeItem('sif_user');
  },

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const token = this.getToken();

    const headers = {
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Automatically set Content-Type to application/json if body is plain object
    if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({ success: false, error: 'Invalid response from server.' }));

      if (response.status === 401) {
        // Session invalid / expired
        if (!window.location.pathname.includes('login') && !window.location.pathname.includes('signup') && window.location.pathname !== '/') {
          this.clearAuth();
          window.location.href = '/login.html?expired=1';
        }
      }

      if (!response.ok) {
        throw new Error(data.error || 'Server request failed.');
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  // Auth Methods
  auth: {
    register: (data) => API.request('/api/auth/register', { method: 'POST', body: data }),
    login: (data) => API.request('/api/auth/login', { method: 'POST', body: data }),
    logout: () => API.request('/api/auth/logout', { method: 'POST' }),
    me: () => API.request('/api/auth/me'),
    forgotPassword: (email) => API.request('/api/auth/forgot-password', { method: 'POST', body: { email } }),
    resetPassword: (data) => API.request('/api/auth/reset-password', { method: 'POST', body: data })
  },

  // User Methods
  users: {
    getProfile: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return API.request(`/api/users/profile${query ? '?' + query : ''}`);
    },
    updateProfile: (data) => API.request('/api/users/profile', { method: 'PUT', body: data }),
    search: (q) => API.request(`/api/users/search?q=${encodeURIComponent(q)}`),
    getRandomStranger: () => API.request('/api/users/random-stranger')
  },

  // Chat Methods
  chat: {
    getConversations: () => API.request('/api/chat/conversations'),
    startConversation: (partnerId) => API.request('/api/chat/conversations', { method: 'POST', body: { partnerId } }),
    getMessages: (conversationId, limit, before) => {
      let q = '';
      if (limit) q += `limit=${limit}&`;
      if (before) q += `before=${before}`;
      return API.request(`/api/chat/conversations/${conversationId}/messages${q ? '?' + q : ''}`);
    },
    sendMessage: (data) => API.request('/api/chat/messages', { method: 'POST', body: data }),
    deleteMessage: (messageId, data) => API.request(`/api/chat/messages/${messageId}`, { method: 'DELETE', body: data }),
    uploadImage: (formData) => API.request('/api/chat/upload', { method: 'POST', body: formData })
  },

  // Friends & Moderation Methods
  friends: {
    getList: () => API.request('/api/friends'),
    getRequests: () => API.request('/api/friends/requests'),
    sendRequest: (receiverId) => API.request('/api/friends/requests', { method: 'POST', body: { receiverId } }),
    respondRequest: (requestId, action) => API.request('/api/friends/requests/respond', { method: 'POST', body: { requestId, action } }),
    removeFriend: (friendId) => API.request('/api/friends/remove', { method: 'POST', body: { friendId } }),
    getBlocked: () => API.request('/api/friends/blocked'),
    blockUser: (blockedId, reason) => API.request('/api/friends/block', { method: 'POST', body: { blockedId, reason } }),
    unblockUser: (blockedId) => API.request('/api/friends/unblock', { method: 'POST', body: { blockedId } }),
    reportUser: (data) => API.request('/api/friends/report', { method: 'POST', body: data })
  },

  // Settings & Notifications
  settings: {
    changePassword: (data) => API.request('/api/settings/change-password', { method: 'POST', body: data }),
    getNotifications: () => API.request('/api/settings/notifications'),
    markNotificationsRead: (notificationIds) => API.request('/api/settings/notifications/read', { method: 'POST', body: { notificationIds } })
  },

  // Admin Methods
  admin: {
    getStats: () => API.request('/api/admin/stats'),
    getUsers: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return API.request(`/api/admin/users${q ? '?' + q : ''}`);
    },
    updateUserStatus: (userId, status) => API.request(`/api/admin/users/${userId}/status`, { method: 'PUT', body: { status } }),
    getReports: (status) => API.request(`/api/admin/reports${status ? '?status=' + status : ''}`),
    updateReportStatus: (reportId, data) => API.request(`/api/admin/reports/${reportId}`, { method: 'PUT', body: data }),
    getSettings: () => API.request('/api/admin/settings'),
    updateSetting: (key, value) => API.request('/api/admin/settings', { method: 'POST', body: { key, value } })
  }
};
