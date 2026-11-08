/**
 * STRANGERS INTO FRIENDS - Admin Dashboard Controller
 */

let allAdminUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
  const token = API.getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  const user = API.getCurrentUser();
  if (!user || user.Role !== 'admin') {
    alert('Access restricted: Administrator credentials required.');
    window.location.href = '/dashboard.html';
    return;
  }

  // Load Admin Data
  await Promise.all([
    loadAdminStats(),
    loadAdminUsers(),
    loadAdminReports(),
    loadPlatformSettings()
  ]);

  // User search filter
  const searchInput = document.getElementById('admin-user-search');
  if (searchInput) {
    let t;
    searchInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => filterAdminUsers(searchInput.value.trim().toLowerCase()), 300);
    });
  }

  // Settings form submit
  const settingsForm = document.getElementById('platform-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', handleSaveSettings);
  }

  // Report review modal close
  const closeReportModal = document.getElementById('close-report-modal');
  if (closeReportModal) {
    closeReportModal.addEventListener('click', () => {
      document.getElementById('admin-report-modal').classList.remove('open');
    });
  }
});

async function loadAdminStats() {
  try {
    const res = await API.admin.getStats();
    const stats = res.stats || {};

    const totalUsersEl = document.getElementById('admin-stat-total-users');
    if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers || 0;

    const activeUsersEl = document.getElementById('admin-stat-active-users');
    if (activeUsersEl) activeUsersEl.textContent = stats.activeUsers || 0;

    const onlineUsersEl = document.getElementById('admin-stat-online-users');
    if (onlineUsersEl) onlineUsersEl.textContent = stats.onlineUsers || 0;

    const totalMessagesEl = document.getElementById('admin-stat-total-messages');
    if (totalMessagesEl) totalMessagesEl.textContent = stats.totalMessages || 0;

    const pendingReportsEl = document.getElementById('admin-stat-pending-reports');
    if (pendingReportsEl) pendingReportsEl.textContent = stats.pendingReports || 0;
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

async function loadAdminUsers() {
  try {
    const res = await API.admin.getUsers();
    allAdminUsers = res.users || [];
    renderAdminUsersTable(allAdminUsers);
  } catch (err) {
    console.error('Failed to load users for admin:', err);
  }
}

function renderAdminUsersTable(users) {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No users found.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isSuspended = u.Status === 'suspended';
    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div class="avatar-wrapper">
              <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.FullName)}&background=7c3aed&color=fff" style="width:36px; height:36px; border-radius:50%;" alt="">
              <span class="status-dot ${u.isOnline ? 'online' : 'offline'}"></span>
            </div>
            <div>
              <div style="font-weight:700; color:#fff;">${Utils.escapeHtml(u.FullName)}</div>
              <div style="font-size:0.78rem; color:var(--text-muted);">@${Utils.escapeHtml(u.Username)}</div>
            </div>
          </div>
        </td>
        <td>${Utils.escapeHtml(u.Email)}</td>
        <td>${Utils.escapeHtml(u.Mobile || 'N/A')}</td>
        <td><span class="badge ${u.Role === 'admin' ? 'badge-purple' : 'badge-blue'}">${Utils.escapeHtml(u.Role)}</span></td>
        <td><span class="badge ${isSuspended ? 'badge-danger' : 'badge-success'}">${Utils.escapeHtml(u.Status)}</span></td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            ${isSuspended ? 
              `<button class="btn btn-success btn-sm" onclick="toggleUserStatus('${u.UserID}', 'active')">Activate</button>` :
              `<button class="btn btn-danger btn-sm" onclick="toggleUserStatus('${u.UserID}', 'suspended')">Suspend</button>`
            }
            <a href="/profile.html?id=${u.UserID}" class="btn btn-outline btn-sm" target="_blank">View</a>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterAdminUsers(q) {
  if (!q) {
    renderAdminUsersTable(allAdminUsers);
    return;
  }
  const filtered = allAdminUsers.filter(u => 
    u.FullName.toLowerCase().includes(q) ||
    u.Username.toLowerCase().includes(q) ||
    u.Email.toLowerCase().includes(q)
  );
  renderAdminUsersTable(filtered);
}

async function toggleUserStatus(userId, status) {
  const actionText = status === 'suspended' ? 'suspend' : 'activate';
  if (!confirm(`Are you sure you want to ${actionText} this user?`)) return;

  try {
    await API.admin.updateUserStatus(userId, status);
    Utils.showToast('User Updated', `Account status set to ${status}.`, 'success');
    await loadAdminUsers();
    await loadAdminStats();
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}

async function loadAdminReports() {
  try {
    const res = await API.admin.getReports();
    const reports = res.reports || [];
    const tbody = document.getElementById('admin-reports-tbody');
    if (!tbody) return;

    if (reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No reports submitted. Community is peaceful!</td></tr>';
      return;
    }

    tbody.innerHTML = reports.map(r => `
      <tr>
        <td><strong>${Utils.escapeHtml(r.Reporter.FullName)}</strong><br><small style="color:var(--text-muted);">@${Utils.escapeHtml(r.Reporter.Username)}</small></td>
        <td><strong style="color:#f87171;">${Utils.escapeHtml(r.ReportedUser.FullName)}</strong><br><small style="color:var(--text-muted);">@${Utils.escapeHtml(r.ReportedUser.Username)}</small></td>
        <td><span class="badge badge-danger">${Utils.escapeHtml(r.Reason)}</span></td>
        <td><span style="font-size:0.85rem; color:var(--text-secondary);">${Utils.escapeHtml(r.Details || 'No additional details')}</span></td>
        <td><span class="badge ${r.Status === 'pending' ? 'badge-purple' : 'badge-blue'}">${Utils.escapeHtml(r.Status)}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openReviewReportModal('${r.ReportID}', '${r.ReportedUser.UserID}', '${Utils.escapeHtml(r.ReportedUser.FullName)}', '${Utils.escapeHtml(r.Reason)}')">Review</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load reports:', err);
  }
}

function openReviewReportModal(reportId, reportedUserId, name, reason) {
  const modal = document.getElementById('admin-report-modal');
  if (!modal) return;

  document.getElementById('modal-report-id').value = reportId;
  document.getElementById('modal-reported-user-id').value = reportedUserId;
  document.getElementById('modal-report-target-name').textContent = name;
  document.getElementById('modal-report-reason').textContent = reason;

  modal.classList.add('open');
}

async function submitReportAction(status, suspendUser = false) {
  const reportId = document.getElementById('modal-report-id').value;
  const reportedUserId = document.getElementById('modal-reported-user-id').value;
  const adminNotes = document.getElementById('modal-admin-notes').value.trim();

  try {
    await API.admin.updateReportStatus(reportId, {
      status: status,
      adminNotes: adminNotes,
      suspendUser: suspendUser,
      reportedUserId: reportedUserId
    });

    Utils.showToast('Report Updated', 'Moderation action saved.', 'success');
    document.getElementById('admin-report-modal').classList.remove('open');
    await loadAdminReports();
    await loadAdminUsers();
    await loadAdminStats();
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}

async function loadPlatformSettings() {
  try {
    const res = await API.admin.getSettings();
    const s = res.settings || {};

    const nameInput = document.getElementById('setting-platform-name');
    if (nameInput && s.PlatformName) nameInput.value = s.PlatformName;

    const taglineInput = document.getElementById('setting-tagline');
    if (taglineInput && s.Tagline) taglineInput.value = s.Tagline;

    const allowReg = document.getElementById('setting-allow-registration');
    if (allowReg && s.AllowRegistration !== undefined) allowReg.checked = s.AllowRegistration === 'true';

    const maintenance = document.getElementById('setting-maintenance-mode');
    if (maintenance && s.MaintenanceMode !== undefined) maintenance.checked = s.MaintenanceMode === 'true';
  } catch (err) {
    console.error('Failed to load platform settings:', err);
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const platformName = document.getElementById('setting-platform-name').value.trim();
    const tagline = document.getElementById('setting-tagline').value.trim();
    const allowReg = document.getElementById('setting-allow-registration').checked;
    const maintenance = document.getElementById('setting-maintenance-mode').checked;

    await API.admin.updateSetting('PlatformName', platformName);
    await API.admin.updateSetting('Tagline', tagline);
    await API.admin.updateSetting('AllowRegistration', allowReg);
    await API.admin.updateSetting('MaintenanceMode', maintenance);

    Utils.showToast('Settings Saved', 'Platform settings successfully updated in Google Sheets.', 'success');
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Platform Settings';
  }
}
