/**
 * STRANGERS INTO FRIENDS - Friends Management Controller
 */

let allFriendsList = [];

document.addEventListener('DOMContentLoaded', async () => {
  const token = API.getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Setup tabs
  setupTabs();

  // Load friends
  await loadAllFriends();
  await loadFriendRequests();
  await loadBlockedUsers();

  // Search filter
  const searchInput = document.getElementById('friends-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterFriends(searchInput.value.trim().toLowerCase());
    });
  }

  // Discover search
  const discoverInput = document.getElementById('discover-search-input');
  if (discoverInput) {
    let t;
    discoverInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => handleDiscoverSearch(discoverInput.value.trim()), 300);
    });
  }

  // Auto select tab from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const tab = urlParams.get('tab');
  if (tab) {
    const tabBtn = document.querySelector(`[data-tab="${tab}"]`);
    if (tabBtn) tabBtn.click();
  }
});

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

async function loadAllFriends() {
  try {
    const res = await API.friends.getList();
    allFriendsList = res.friends || [];
    renderFriends(allFriendsList);
    renderOnlineFriends(allFriendsList.filter(f => f.isOnline));

    const countBadge = document.getElementById('all-friends-count');
    if (countBadge) countBadge.textContent = allFriendsList.length;

    const onlineBadge = document.getElementById('online-friends-count');
    if (onlineBadge) onlineBadge.textContent = allFriendsList.filter(f => f.isOnline).length;
  } catch (err) {
    console.error('Failed to load friends:', err);
  }
}

function renderFriends(friends) {
  const container = document.getElementById('all-friends-grid');
  if (!container) return;

  if (friends.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">No Friends Found</div>
        <p class="empty-state-desc">You haven't added any friends yet. Explore strangers in the Discover tab to connect!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = friends.map(f => `
    <div class="friend-card">
      <div class="avatar-wrapper">
        <img src="${f.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.FullName)}`}" class="friend-card-avatar" alt="${Utils.escapeHtml(f.FullName)}">
        <span class="status-dot ${f.isOnline ? 'online' : 'offline'}"></span>
      </div>
      <div class="friend-card-name">${Utils.escapeHtml(f.FullName)}</div>
      <div class="friend-card-handle">@${Utils.escapeHtml(f.Username)}</div>
      <div class="friend-card-bio">${Utils.escapeHtml(f.Bio || 'No bio yet')}</div>
      <div class="friend-card-actions">
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="startChat('${f.UserID}')">Chat Now</button>
        <button class="btn btn-outline btn-sm btn-icon" onclick="removeFriend('${f.UserID}', '${Utils.escapeHtml(f.FullName)}')" title="Remove Friend">✕</button>
      </div>
    </div>
  `).join('');
}

function renderOnlineFriends(onlineFriends) {
  const container = document.getElementById('online-friends-grid');
  if (!container) return;

  if (onlineFriends.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🟢</div>
        <div class="empty-state-title">No Friends Online</div>
        <p class="empty-state-desc">None of your friends are currently active. Check back soon or message them!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = onlineFriends.map(f => `
    <div class="friend-card">
      <div class="avatar-wrapper">
        <img src="${f.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.FullName)}`}" class="friend-card-avatar" alt="${Utils.escapeHtml(f.FullName)}">
        <span class="status-dot online"></span>
      </div>
      <div class="friend-card-name">${Utils.escapeHtml(f.FullName)}</div>
      <div class="friend-card-handle">@${Utils.escapeHtml(f.Username)}</div>
      <div class="friend-card-bio">${Utils.escapeHtml(f.Bio || 'Available to chat')}</div>
      <div class="friend-card-actions">
        <button class="btn btn-primary btn-sm" style="width:100%;" onclick="startChat('${f.UserID}')">Chat Now</button>
      </div>
    </div>
  `).join('');
}

function filterFriends(q) {
  if (!q) {
    renderFriends(allFriendsList);
    return;
  }
  const filtered = allFriendsList.filter(f => 
    f.FullName.toLowerCase().includes(q) || 
    f.Username.toLowerCase().includes(q)
  );
  renderFriends(filtered);
}

async function loadFriendRequests() {
  try {
    const res = await API.friends.getRequests();
    const received = res.received || [];
    const sent = res.sent || [];

    const reqBadge = document.getElementById('requests-count');
    if (reqBadge) reqBadge.textContent = received.length;

    // Render Received
    const receivedEl = document.getElementById('received-requests-list');
    if (receivedEl) {
      if (received.length === 0) {
        receivedEl.innerHTML = '<div style="color:var(--text-muted); padding:1rem 0;">No incoming friend requests.</div>';
      } else {
        receivedEl.innerHTML = received.map(r => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:1rem; background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:12px; margin-bottom:0.75rem;">
            <div style="display:flex; align-items:center; gap:0.85rem;">
              <img src="${r.Sender.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.Sender.FullName)}`}" style="width:44px; height:44px; border-radius:50%;" alt="">
              <div>
                <div style="font-weight:700; color:#fff;">${Utils.escapeHtml(r.Sender.FullName)}</div>
                <div style="font-size:0.82rem; color:var(--text-muted);">@${Utils.escapeHtml(r.Sender.Username)} &bull; ${Utils.formatTimeAgo(r.CreatedAt)}</div>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-primary btn-sm" onclick="handleRespondRequest('${r.RequestID}', 'accept')">Accept</button>
              <button class="btn btn-secondary btn-sm" onclick="handleRespondRequest('${r.RequestID}', 'reject')">Decline</button>
            </div>
          </div>
        `).join('');
      }
    }

    // Render Sent
    const sentEl = document.getElementById('sent-requests-list');
    if (sentEl) {
      if (sent.length === 0) {
        sentEl.innerHTML = '<div style="color:var(--text-muted); padding:1rem 0;">No pending sent requests.</div>';
      } else {
        sentEl.innerHTML = sent.map(r => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1rem; background:rgba(255,255,255,0.02); border:1px solid var(--border-subtle); border-radius:12px; margin-bottom:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <img src="${r.Receiver.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.Receiver.FullName)}`}" style="width:36px; height:36px; border-radius:50%;" alt="">
              <div>
                <div style="font-weight:600; color:#fff; font-size:0.9rem;">${Utils.escapeHtml(r.Receiver.FullName)}</div>
                <div style="font-size:0.78rem; color:var(--text-muted);">@${Utils.escapeHtml(r.Receiver.Username)}</div>
              </div>
            </div>
            <span class="badge badge-purple">Pending</span>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load requests:', err);
  }
}

async function handleRespondRequest(requestId, action) {
  try {
    const res = await API.friends.respondRequest(requestId, action);
    Utils.showToast(action === 'accept' ? 'Friend Added' : 'Declined', res.message, 'success');
    await loadFriendRequests();
    await loadAllFriends();
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}

async function removeFriend(friendId, friendName) {
  if (!confirm(`Are you sure you want to remove ${friendName} from your friends list?`)) return;
  try {
    await API.friends.removeFriend(friendId);
    Utils.showToast('Removed', `${friendName} has been removed.`, 'info');
    await loadAllFriends();
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}

async function handleDiscoverSearch(q) {
  const container = document.getElementById('discover-results-grid');
  if (!container) return;

  if (!q) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:2rem;">Type a name or username above to find strangers!</div>';
    return;
  }

  try {
    const res = await API.users.search(q);
    const users = res.users || [];

    if (users.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:2rem;">No strangers found matching "${Utils.escapeHtml(q)}"</div>`;
      return;
    }

    container.innerHTML = users.map(u => `
      <div class="friend-card">
        <img src="${u.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.FullName)}`}" class="friend-card-avatar" alt="">
        <div class="friend-card-name">${Utils.escapeHtml(u.FullName)}</div>
        <div class="friend-card-handle">@${Utils.escapeHtml(u.Username)}</div>
        <div class="friend-card-bio">${Utils.escapeHtml(u.Bio || 'Looking to connect')}</div>
        <div class="friend-card-actions">
          <a href="/profile.html?id=${u.UserID}" class="btn btn-outline btn-sm" style="flex:1;">Profile</a>
          <button class="btn btn-primary btn-sm" style="flex:1;" onclick="sendFriendRequestFromList('${u.UserID}')">Add Friend</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Discover error:', err);
  }
}

async function sendFriendRequestFromList(userId) {
  try {
    await API.friends.sendRequest(userId);
    Utils.showToast('Sent!', 'Friend request sent to user.', 'success');
    loadFriendRequests();
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}

async function loadBlockedUsers() {
  try {
    const res = await API.friends.getBlocked();
    const blocked = res.blocked || [];
    const container = document.getElementById('blocked-users-list');
    if (!container) return;

    if (blocked.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); padding:1rem 0;">No blocked users.</div>';
      return;
    }

    container.innerHTML = blocked.map(b => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1rem; background:rgba(255,255,255,0.02); border:1px solid var(--border-subtle); border-radius:12px; margin-bottom:0.5rem;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <img src="${b.user.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.user.FullName)}`}" style="width:38px; height:38px; border-radius:50%;" alt="">
          <div>
            <div style="font-weight:600; color:#fff;">${Utils.escapeHtml(b.user.FullName)}</div>
            <div style="font-size:0.78rem; color:var(--text-muted);">Blocked on ${Utils.formatDate(b.CreatedAt)}</div>
          </div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="unblockUser('${b.BlockedID}')">Unblock</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load blocked users:', err);
  }
}

async function unblockUser(userId) {
  try {
    await API.friends.unblockUser(userId);
    Utils.showToast('Unblocked', 'User unblocked successfully.', 'success');
    loadBlockedUsers();
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}

function startChat(userId) {
  window.location.href = `/chat.html?user=${userId}`;
}
