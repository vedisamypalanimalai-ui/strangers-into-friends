/**
 * STRANGERS INTO FRIENDS - User Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const token = API.getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  const currentUser = API.getCurrentUser();
  if (currentUser) {
    // Populate Welcome Banner & Profile Info
    const welcomeName = document.getElementById('welcome-user-name');
    if (welcomeName) welcomeName.textContent = currentUser.FullName;

    const userAvatar = document.getElementById('dash-user-avatar');
    if (userAvatar) userAvatar.src = currentUser.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.FullName)}&background=7c3aed&color=fff`;

    const userName = document.getElementById('dash-user-fullname');
    if (userName) userName.textContent = currentUser.FullName;

    const userHandle = document.getElementById('dash-user-handle');
    if (userHandle) userHandle.textContent = `@${currentUser.Username}`;

    const userBio = document.getElementById('dash-user-bio');
    if (userBio) userBio.textContent = currentUser.Bio || 'Turning strangers into friends!';
  }

  // Load dashboard data
  await Promise.all([
    loadFriendsAndStats(),
    loadRecentConversations(),
    loadFriendRequests()
  ]);

  // Hook up "Meet a Stranger" button
  const strangerBtn = document.getElementById('btn-meet-stranger');
  if (strangerBtn) {
    strangerBtn.addEventListener('click', handleMeetStranger);
  }

  // Hook up User Search
  const searchInput = document.getElementById('dashboard-user-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        handleSearchUsers(searchInput.value.trim());
      }, 350);
    });
  }

  // Listen to Socket events to keep dashboard live
  window.addEventListener('sif:user_status_change', () => {
    loadFriendsAndStats();
  });
  window.addEventListener('sif:new_message', () => {
    loadRecentConversations();
  });
  window.addEventListener('sif:new_friend_request', () => {
    loadFriendRequests();
  });
});

async function loadFriendsAndStats() {
  try {
    const res = await API.friends.getList();
    const friends = res.friends || [];

    const totalFriendsEl = document.getElementById('stat-total-friends');
    if (totalFriendsEl) totalFriendsEl.textContent = friends.length;

    const onlineFriends = friends.filter(f => f.isOnline);
    const onlineFriendsEl = document.getElementById('stat-online-friends');
    if (onlineFriendsEl) onlineFriendsEl.textContent = onlineFriends.length;

    renderOnlineFriends(onlineFriends);
  } catch (err) {
    console.error('Failed to load friends:', err);
  }
}

function renderOnlineFriends(onlineFriends) {
  const container = document.getElementById('online-friends-container');
  if (!container) return;

  if (onlineFriends.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-muted); font-size: 0.9rem; padding: 1rem 0;">
        No friends are currently online. Meet new strangers below to make more friends!
      </div>
    `;
    return;
  }

  container.innerHTML = onlineFriends.map(f => `
    <div class="online-friend-item" onclick="startChatWithUser('${f.UserID}')">
      <div class="online-friend-avatar">
        <img src="${f.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.FullName)}`}" alt="${Utils.escapeHtml(f.FullName)}">
      </div>
      <span class="online-friend-name">${Utils.escapeHtml(f.FullName.split(' ')[0])}</span>
    </div>
  `).join('');
}

async function loadRecentConversations() {
  try {
    const res = await API.chat.getConversations();
    const convs = res.conversations || [];

    const activeChatsEl = document.getElementById('stat-active-chats');
    if (activeChatsEl) activeChatsEl.textContent = convs.length;

    // Calculate unread total
    const totalUnread = convs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    const unreadEl = document.getElementById('stat-unread-messages');
    if (unreadEl) unreadEl.textContent = totalUnread;

    const container = document.getElementById('recent-chats-container');
    if (!container) return;

    if (convs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-title">No Conversations Yet</div>
          <p class="empty-state-desc">Break the ice! Search for strangers or click Meet a Stranger to start talking.</p>
          <a href="/chat.html" class="btn btn-primary btn-sm">Start a Conversation</a>
        </div>
      `;
      return;
    }

    container.innerHTML = convs.slice(0, 5).map(c => `
      <div class="conversation-item" onclick="window.location.href='/chat.html?c=${c.ConversationID}'">
        <div class="avatar-wrapper">
          <img src="${c.partner.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.partner.FullName)}`}" class="conv-avatar" alt="${Utils.escapeHtml(c.partner.FullName)}">
          <span class="status-dot ${c.partner.isOnline ? 'online' : 'offline'}"></span>
        </div>
        <div class="conv-info">
          <div class="conv-top">
            <span class="conv-name">${Utils.escapeHtml(c.partner.FullName)}</span>
            <span class="conv-time">${Utils.formatTimeAgo(c.LastMessageTimestamp)}</span>
          </div>
          <div class="conv-bottom">
            <span class="conv-snippet">${Utils.escapeHtml(c.LastMessageContent || 'No messages yet')}</span>
            ${c.unreadCount > 0 ? `<span class="unread-badge">${c.unreadCount}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

async function loadFriendRequests() {
  try {
    const res = await API.friends.getRequests();
    const received = res.received || [];
    const container = document.getElementById('friend-requests-container');
    if (!container) return;

    if (received.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.88rem; padding: 0.75rem 0;">
          No pending friend requests.
        </div>
      `;
      return;
    }

    container.innerHTML = received.map(r => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 0; border-bottom: 1px solid var(--border-subtle);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <img src="${r.Sender.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.Sender.FullName)}`}" style="width: 38px; height: 38px; border-radius: 50%;" alt="${Utils.escapeHtml(r.Sender.FullName)}">
          <div>
            <div style="font-size: 0.92rem; font-weight: 600; color: #fff;">${Utils.escapeHtml(r.Sender.FullName)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">@${Utils.escapeHtml(r.Sender.Username)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-primary btn-sm" onclick="respondRequest('${r.RequestID}', 'accept')">Accept</button>
          <button class="btn btn-secondary btn-sm" onclick="respondRequest('${r.RequestID}', 'reject')">Decline</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load friend requests:', err);
  }
}

async function respondRequest(requestId, action) {
  try {
    const res = await API.friends.respondRequest(requestId, action);
    Utils.showToast(action === 'accept' ? 'Friend Added' : 'Declined', res.message, 'success');
    loadFriendRequests();
    loadFriendsAndStats();
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}

async function handleMeetStranger() {
  const strangerBtn = document.getElementById('btn-meet-stranger');
  const modal = document.getElementById('stranger-modal');
  const modalBody = document.getElementById('stranger-modal-body');

  try {
    if (strangerBtn) {
      strangerBtn.disabled = true;
      strangerBtn.innerHTML = 'Finding Stranger...';
    }

    const res = await API.users.getRandomStranger();
    if (!res.stranger) {
      Utils.showToast('Discover Strangers', res.message || 'No strangers found right now.', 'info');
      return;
    }

    const s = res.stranger;
    if (modal && modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 1rem 0;">
          <img src="${s.ProfilePicture}" style="width: 90px; height: 90px; border-radius: 50%; margin: 0 auto 1rem; border: 3px solid var(--primary);" alt="${Utils.escapeHtml(s.FullName)}">
          <h3 style="font-size: 1.35rem; color: #fff; margin-bottom: 0.25rem;">${Utils.escapeHtml(s.FullName)}</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 1rem;">@${Utils.escapeHtml(s.Username)} &bull; ${Utils.escapeHtml(s.Location || 'Earth')}</p>
          <p style="color: var(--text-secondary); font-size: 0.95rem; background: rgba(255,255,255,0.04); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem;">
            "${Utils.escapeHtml(s.Bio || 'Ready to meet someone new!')}"
          </p>
          <div style="display: flex; justify-content: center; gap: 1rem;">
            <button class="btn btn-primary" onclick="sendStrangerRequest('${s.UserID}')">Send Friend Request</button>
            <button class="btn btn-secondary" onclick="startChatWithUser('${s.UserID}')">Send Message</button>
          </div>
        </div>
      `;
      modal.classList.add('open');
    }
  } catch (err) {
    Utils.showToast('Error', err.message || 'Error discovering stranger.', 'error');
  } finally {
    if (strangerBtn) {
      strangerBtn.disabled = false;
      strangerBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
        Meet a Stranger
      `;
    }
  }
}

async function sendStrangerRequest(userId) {
  try {
    await API.friends.sendRequest(userId);
    Utils.showToast('Request Sent', 'Friend request delivered to stranger!', 'success');
    const modal = document.getElementById('stranger-modal');
    if (modal) modal.classList.remove('open');
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}

async function startChatWithUser(partnerId) {
  try {
    const res = await API.chat.startConversation(partnerId);
    window.location.href = `/chat.html?c=${res.conversation.ConversationID}`;
  } catch (err) {
    Utils.showToast('Chat Error', err.message, 'error');
  }
}

async function handleSearchUsers(query) {
  const resultsContainer = document.getElementById('search-results-container');
  if (!resultsContainer) return;

  if (!query) {
    resultsContainer.innerHTML = '';
    resultsContainer.style.display = 'none';
    return;
  }

  try {
    const res = await API.users.search(query);
    const users = res.users || [];

    if (users.length === 0) {
      resultsContainer.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); text-align: center;">No users found matching "' + Utils.escapeHtml(query) + '"</div>';
      resultsContainer.style.display = 'block';
      return;
    }

    resultsContainer.innerHTML = users.map(u => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-subtle);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <img src="${u.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.FullName)}`}" style="width: 36px; height: 36px; border-radius: 50%;" alt="${Utils.escapeHtml(u.FullName)}">
          <div>
            <div style="font-weight: 600; color: #fff; font-size: 0.9rem;">${Utils.escapeHtml(u.FullName)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">@${Utils.escapeHtml(u.Username)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 0.4rem;">
          <a href="/profile.html?id=${u.UserID}" class="btn btn-outline btn-sm">Profile</a>
          <button class="btn btn-primary btn-sm" onclick="sendStrangerRequest('${u.UserID}')">Add Friend</button>
        </div>
      </div>
    `).join('');
    resultsContainer.style.display = 'block';
  } catch (err) {
    console.error('Search error:', err);
  }
}
