/**
 * STRANGERS INTO FRIENDS - Profile Controller
 */

let targetUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = API.getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('id');
  const paramUsername = urlParams.get('u');

  await loadProfile(paramId, paramUsername);

  // Setup Edit Profile Form
  const editForm = document.getElementById('edit-profile-form');
  if (editForm) {
    editForm.addEventListener('submit', handleProfileUpdate);
  }

  // Toggle Edit Modal
  const editBtn = document.getElementById('btn-edit-profile');
  const editModal = document.getElementById('edit-profile-modal');
  const closeEditBtn = document.getElementById('close-edit-modal');

  if (editBtn && editModal) {
    editBtn.addEventListener('click', () => editModal.classList.add('open'));
    if (closeEditBtn) {
      closeEditBtn.addEventListener('click', () => editModal.classList.remove('open'));
    }
  }
});

async function loadProfile(id, username) {
  try {
    const res = await API.users.getProfile({ id, username });
    const user = res.user;
    const relationship = res.relationship;
    targetUserId = user.UserID;

    // Populate UI Elements
    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) avatarEl.src = user.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.FullName)}&background=7c3aed&color=fff&size=200`;

    const nameEl = document.getElementById('profile-name');
    if (nameEl) nameEl.textContent = user.FullName;

    const handleEl = document.getElementById('profile-handle');
    if (handleEl) handleEl.textContent = `@${user.Username}`;

    const bioEl = document.getElementById('profile-bio');
    if (bioEl) bioEl.textContent = user.Bio || 'No bio provided.';

    const locationEl = document.getElementById('profile-location');
    if (locationEl) locationEl.textContent = user.Location || 'Planet Earth';

    const genderEl = document.getElementById('profile-gender');
    if (genderEl) genderEl.textContent = user.Gender || 'Not specified';

    const joinedEl = document.getElementById('profile-joined');
    if (joinedEl) joinedEl.textContent = Utils.formatDate(user.CreatedAt);

    // Populate Edit Form Defaults if editing self
    if (relationship === 'self') {
      const editName = document.getElementById('edit-fullname');
      if (editName) editName.value = user.FullName;

      const editBio = document.getElementById('edit-bio');
      if (editBio) editBio.value = user.Bio || '';

      const editLocation = document.getElementById('edit-location');
      if (editLocation) editLocation.value = user.Location || '';

      const editGender = document.getElementById('edit-gender');
      if (editGender) editGender.value = user.Gender || 'Other';

      const editMobile = document.getElementById('edit-mobile');
      if (editMobile) editMobile.value = user.Mobile || '';

      const editAvatar = document.getElementById('edit-avatar');
      if (editAvatar) editAvatar.value = user.ProfilePicture || '';

      // Show Edit Profile button
      const editBtn = document.getElementById('btn-edit-profile');
      if (editBtn) editBtn.style.display = 'inline-flex';
    } else {
      // Viewing another user: Render relationship actions (Add Friend, Message, Block)
      renderVisitorActions(user, relationship);
    }
  } catch (err) {
    Utils.showToast('Profile Error', err.message || 'User not found.', 'error');
  }
}

function renderVisitorActions(user, relationship) {
  const container = document.getElementById('profile-actions-container');
  if (!container) return;

  let actionHtml = '';

  if (relationship === 'friend') {
    actionHtml = `
      <a href="/chat.html?user=${user.UserID}" class="btn btn-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Send Message
      </a>
      <button class="btn btn-danger btn-outline" onclick="blockThisUser('${user.UserID}')">Block User</button>
    `;
  } else if (relationship === 'request_sent') {
    actionHtml = `
      <button class="btn btn-secondary" disabled>Friend Request Pending</button>
      <a href="/chat.html?user=${user.UserID}" class="btn btn-outline">Message</a>
    `;
  } else if (relationship === 'request_received') {
    actionHtml = `
      <a href="/friends.html?tab=requests" class="btn btn-primary">Respond to Request</a>
    `;
  } else {
    actionHtml = `
      <button class="btn btn-primary" onclick="sendFriendRequestTo('${user.UserID}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        Add Friend
      </button>
      <a href="/chat.html?user=${user.UserID}" class="btn btn-secondary">Direct Message</a>
      <button class="btn btn-danger btn-outline" onclick="blockThisUser('${user.UserID}')">Block</button>
    `;
  }

  container.innerHTML = actionHtml;
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const updates = {
    fullName: document.getElementById('edit-fullname').value.trim(),
    bio: document.getElementById('edit-bio').value.trim(),
    location: document.getElementById('edit-location').value.trim(),
    gender: document.getElementById('edit-gender').value,
    mobile: document.getElementById('edit-mobile').value.trim(),
    profilePicture: document.getElementById('edit-avatar').value.trim()
  };

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const res = await API.users.updateProfile(updates);
    API.setCurrentUser(res.user);

    Utils.showToast('Profile Updated', 'Your profile details have been saved.', 'success');
    document.getElementById('edit-profile-modal').classList.remove('open');

    // Reload UI
    await loadProfile(res.user.UserID);
  } catch (err) {
    Utils.showToast('Update Failed', err.message || 'Could not update profile.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
  }
}

async function sendFriendRequestTo(userId) {
  try {
    await API.friends.sendRequest(userId);
    Utils.showToast('Request Sent', 'Friend request delivered!', 'success');
    await loadProfile(userId);
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}

async function blockThisUser(userId) {
  if (!confirm('Are you sure you want to block this user?')) return;
  try {
    await API.friends.blockUser(userId, 'Blocked from profile');
    Utils.showToast('Blocked', 'User blocked.', 'info');
    window.location.href = '/dashboard.html';
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}
