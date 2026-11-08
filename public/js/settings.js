/**
 * STRANGERS INTO FRIENDS - Account & Privacy Settings Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const token = API.getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Load account info
  const user = API.getCurrentUser();
  if (user) {
    const emailEl = document.getElementById('settings-email');
    if (emailEl) emailEl.value = user.Email;

    const usernameEl = document.getElementById('settings-username');
    if (usernameEl) usernameEl.value = user.Username;

    const mobileEl = document.getElementById('settings-mobile');
    if (mobileEl) mobileEl.value = user.Mobile;
  }

  // Load Notifications
  await loadNotifications();

  // Change Password Form
  const passwordForm = document.getElementById('change-password-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handleChangePassword);
  }

  // Sound effects toggle
  const soundToggle = document.getElementById('toggle-sound-effects');
  if (soundToggle) {
    soundToggle.checked = localStorage.getItem('sif_sound_enabled') !== 'false';
    soundToggle.addEventListener('change', () => {
      localStorage.setItem('sif_sound_enabled', soundToggle.checked);
      Utils.showToast('Preferences', `Sound notifications ${soundToggle.checked ? 'enabled' : 'muted'}.`, 'info');
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('btn-logout-settings');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await API.auth.logout();
      } catch (e) {}
      API.clearAuth();
      window.location.href = '/login.html';
    });
  }
});

async function handleChangePassword(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (newPassword !== confirmPassword) {
    Utils.showToast('Validation Error', 'New passwords do not match.', 'error');
    return;
  }

  if (newPassword.length < 6) {
    Utils.showToast('Validation Error', 'Password must be at least 6 characters.', 'error');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';

    const res = await API.settings.changePassword({ currentPassword, newPassword });
    Utils.showToast('Success', res.message, 'success');
    e.target.reset();
  } catch (err) {
    Utils.showToast('Error', err.message || 'Failed to update password.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Update Password';
  }
}

async function loadNotifications() {
  const container = document.getElementById('notifications-list');
  if (!container) return;

  try {
    const res = await API.settings.getNotifications();
    const notifs = res.notifications || [];

    if (notifs.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); padding:1rem 0;">No notifications yet.</div>';
      return;
    }

    container.innerHTML = notifs.map(n => `
      <div style="padding:0.85rem 1rem; background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:10px; margin-bottom:0.5rem; display:flex; align-items:center; justify-content:space-between;">
        <div>
          <div style="font-weight:600; color:#fff; font-size:0.92rem;">${Utils.escapeHtml(n.Title)}</div>
          <div style="font-size:0.82rem; color:var(--text-secondary);">${Utils.escapeHtml(n.Body)}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${Utils.formatTimeAgo(n.CreatedAt)}</div>
        </div>
        ${n.Link ? `<a href="${n.Link}" class="btn btn-outline btn-sm">View</a>` : ''}
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }
}
