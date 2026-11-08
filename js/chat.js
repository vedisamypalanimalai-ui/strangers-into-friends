/**
 * STRANGERS INTO FRIENDS - Real-Time Chat Engine
 */

let activeConversationId = null;
let activePartner = null;
let conversationsList = [];
let typingTimeout = null;

const EMOJIS = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰',
  '😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏',
  '😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠',
  '😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥',
  '😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
  '💘','💝','👍','👎','👏','🙌','👐','🤲','🤝','🙏','✌️','🤞','🤟','🤘','🤙','🖐️',
  '✋','👌','🔥','✨','🎉','🎂','🍕','🍔','☕','🍻','🥂','🌈','⭐','🚀','💯','⚡'
];

document.addEventListener('DOMContentLoaded', async () => {
  const token = API.getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Init emoji picker popover
  setupEmojiPicker();

  // Load user conversations
  await loadConversations();

  // Check URL query for direct conversation or partner ID
  const urlParams = new URLSearchParams(window.location.search);
  const convParam = urlParams.get('c');
  const partnerParam = urlParams.get('user');

  if (convParam) {
    selectConversation(convParam);
  } else if (partnerParam) {
    try {
      const res = await API.chat.startConversation(partnerParam);
      await loadConversations();
      selectConversation(res.conversation.ConversationID);
    } catch (e) {
      console.error(e);
    }
  } else if (conversationsList.length > 0) {
    selectConversation(conversationsList[0].ConversationID);
  }

  // Bind message form
  const messageForm = document.getElementById('chat-message-form');
  const messageInput = document.getElementById('chat-input-text');
  if (messageForm && messageInput) {
    messageForm.addEventListener('submit', handleSendMessage);

    // Typing indicator trigger with debounce
    messageInput.addEventListener('input', () => {
      if (!activePartner) return;
      socketClient.emit('typing_start', {
        recipientId: activePartner.UserID,
        conversationId: activeConversationId
      });

      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socketClient.emit('typing_stop', {
          recipientId: activePartner.UserID,
          conversationId: activeConversationId
        });
      }, 1500);
    });

    // Enter to submit, shift+enter for newline
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(e);
      }
    });
  }

  // Bind Image Upload Attachment
  const imageUploadInput = document.getElementById('chat-image-input');
  const imageUploadBtn = document.getElementById('btn-upload-image');
  if (imageUploadBtn && imageUploadInput) {
    imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
    imageUploadInput.addEventListener('change', handleImageUpload);
  }

  // Socket event listeners
  window.addEventListener('sif:new_message', (e) => {
    const data = e.detail;
    if (activeConversationId && data.message.ConversationID === activeConversationId) {
      appendMessageToFeed(data.message, false);
      scrollToBottom();
      // Mark as read immediately
      socketClient.emit('mark_read', {
        conversationId: activeConversationId,
        partnerId: activePartner ? activePartner.UserID : null
      });
    }
    updateConversationSnippet(data.message);
  });

  window.addEventListener('sif:messages_read', (e) => {
    const data = e.detail;
    if (activeConversationId && data.conversationId === activeConversationId) {
      markAllSentMessagesAsRead();
    }
  });

  window.addEventListener('sif:user_typing', (e) => {
    const data = e.detail;
    if (activePartner && String(data.senderId) === String(activePartner.UserID)) {
      showTypingIndicator(true);
    }
  });

  window.addEventListener('sif:user_stop_typing', (e) => {
    const data = e.detail;
    if (activePartner && String(data.senderId) === String(activePartner.UserID)) {
      showTypingIndicator(false);
    }
  });

  window.addEventListener('sif:user_status_change', (e) => {
    const data = e.detail;
    if (activePartner && String(data.userId) === String(activePartner.UserID)) {
      activePartner.isOnline = (data.status === 'online');
      updatePartnerHeaderUI();
    }
    // Update conversation item status dot
    const conv = conversationsList.find(c => String(c.partner.UserID) === String(data.userId));
    if (conv) {
      conv.partner.isOnline = (data.status === 'online');
      renderConversationsList();
    }
  });
});

async function loadConversations() {
  try {
    const res = await API.chat.getConversations();
    conversationsList = res.conversations || [];
    renderConversationsList();
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

function renderConversationsList() {
  const listEl = document.getElementById('conversations-list');
  if (!listEl) return;

  if (conversationsList.length === 0) {
    listEl.innerHTML = `
      <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
        No conversations yet. Add friends or meet strangers to chat!
      </div>
    `;
    return;
  }

  listEl.innerHTML = conversationsList.map(c => `
    <div class="conversation-item ${c.ConversationID === activeConversationId ? 'active' : ''}" 
         onclick="selectConversation('${c.ConversationID}')" id="conv-item-${c.ConversationID}">
      <div class="avatar-wrapper">
        <img src="${c.partner.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.partner.FullName)}`}" class="conv-avatar" alt="${Utils.escapeHtml(c.partner.FullName)}">
        <span class="status-dot ${c.partner.isOnline ? 'online' : 'offline'}" data-user-status-id="${c.partner.UserID}"></span>
      </div>
      <div class="conv-info">
        <div class="conv-top">
          <span class="conv-name">${Utils.escapeHtml(c.partner.FullName)}</span>
          <span class="conv-time">${Utils.formatTimeAgo(c.LastMessageTimestamp)}</span>
        </div>
        <div class="conv-bottom">
          <span class="conv-snippet" id="conv-snippet-${c.ConversationID}">${Utils.escapeHtml(c.LastMessageContent || 'No messages yet')}</span>
          ${c.unreadCount > 0 ? `<span class="unread-badge" id="conv-unread-${c.ConversationID}">${c.unreadCount}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function selectConversation(conversationId) {
  activeConversationId = conversationId;
  const conv = conversationsList.find(c => c.ConversationID === conversationId);
  if (conv) {
    activePartner = conv.partner;
    conv.unreadCount = 0; // reset local unread
  }

  // Update active state in sidebar
  document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
  const activeItem = document.getElementById(`conv-item-${conversationId}`);
  if (activeItem) activeItem.classList.add('active');

  // Remove unread badge
  const unreadEl = document.getElementById(`conv-unread-${conversationId}`);
  if (unreadEl) unreadEl.remove();

  updatePartnerHeaderUI();
  updateRightPanelUI();

  // Load messages from backend
  await loadMessages(conversationId);

  // Notify backend of read status
  if (activePartner) {
    socketClient.emit('mark_read', {
      conversationId: conversationId,
      partnerId: activePartner.UserID
    });
  }
}

async function loadMessages(conversationId) {
  const feed = document.getElementById('chat-messages-feed');
  if (!feed) return;

  feed.innerHTML = `
    <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
      <span class="status-dot online"></span> Loading conversation...
    </div>
  `;

  try {
    const res = await API.chat.getMessages(conversationId);
    const messages = res.messages || [];
    renderMessagesFeed(messages);
  } catch (err) {
    feed.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #f87171;">
        Failed to load messages: ${Utils.escapeHtml(err.message)}
      </div>
    `;
  }
}

function renderMessagesFeed(messages) {
  const feed = document.getElementById('chat-messages-feed');
  if (!feed) return;

  if (messages.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👋</div>
        <div class="empty-state-title">Say hello to ${Utils.escapeHtml(activePartner ? activePartner.FullName : 'your friend')}!</div>
        <p class="empty-state-desc">Break the ice with a compliment, a question, or a friendly wave.</p>
      </div>
    `;
    return;
  }

  const currentUser = API.getCurrentUser();
  feed.innerHTML = messages.map(msg => renderMessageHTML(msg, currentUser)).join('');
  scrollToBottom();
}

function renderMessageHTML(msg, currentUser) {
  const isSent = String(msg.SenderID) === String(currentUser ? currentUser.UserID : '');
  const readCheckmarks = isSent ? (
    msg.Status === 'read' ? '<span style="color: #60a5fa;" title="Read">✓✓</span>' : '<span style="color: #94a3b8;" title="Sent">✓</span>'
  ) : '';

  let bodyContent = '';
  if (msg.MessageType === 'image') {
    bodyContent = `<img src="${msg.Content}" class="msg-image" alt="Image" onclick="window.open('${msg.Content}', '_blank')">`;
  } else {
    bodyContent = Utils.escapeHtml(msg.Content);
  }

  return `
    <div class="msg-wrapper ${isSent ? 'sent' : 'received'}" id="msg-${msg.MessageID}">
      <div class="msg-bubble">
        ${bodyContent}
      </div>
      <div class="msg-meta">
        <span>${Utils.formatTime(msg.Timestamp)}</span>
        ${readCheckmarks}
        ${isSent ? `<button onclick="confirmDeleteMessage('${msg.MessageID}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:11px; margin-left:4px;" title="Delete Message">&times;</button>` : ''}
      </div>
    </div>
  `;
}

function appendMessageToFeed(msg, isSent) {
  const feed = document.getElementById('chat-messages-feed');
  if (!feed) return;

  const emptyState = feed.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const currentUser = API.getCurrentUser();
  const div = document.createElement('div');
  div.innerHTML = renderMessageHTML(msg, currentUser);
  feed.appendChild(div.firstElementChild);
}

function scrollToBottom() {
  const feed = document.getElementById('chat-messages-feed');
  if (feed) {
    feed.scrollTop = feed.scrollHeight;
  }
}

async function handleSendMessage(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('chat-input-text');
  if (!input || !activePartner) return;

  const content = input.value.trim();
  if (!content) return;

  input.value = '';

  // Clear typing
  socketClient.emit('typing_stop', {
    recipientId: activePartner.UserID,
    conversationId: activeConversationId
  });

  try {
    const res = await API.chat.sendMessage({
      receiverId: activePartner.UserID,
      conversationId: activeConversationId,
      content: content,
      messageType: 'text'
    });

    appendMessageToFeed(res.message, true);
    scrollToBottom();
    updateConversationSnippet(res.message);
  } catch (err) {
    Utils.showToast('Error', err.message || 'Could not send message.', 'error');
  }
}

async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file || !activePartner) return;

  if (file.size > 5 * 1024 * 1024) {
    Utils.showToast('File Too Large', 'Maximum image size is 5MB.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('image', file);

  try {
    Utils.showToast('Uploading', 'Uploading your image...', 'info');
    const uploadRes = await API.chat.uploadImage(formData);

    // Send as image message
    const res = await API.chat.sendMessage({
      receiverId: activePartner.UserID,
      conversationId: activeConversationId,
      content: uploadRes.imageUrl,
      messageType: 'image'
    });

    appendMessageToFeed(res.message, true);
    scrollToBottom();
    updateConversationSnippet(res.message);
  } catch (err) {
    Utils.showToast('Upload Failed', err.message || 'Could not upload image.', 'error');
  } finally {
    e.target.value = '';
  }
}

function updatePartnerHeaderUI() {
  if (!activePartner) return;
  const avatarEl = document.getElementById('chat-partner-avatar');
  if (avatarEl) avatarEl.src = activePartner.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(activePartner.FullName)}`;

  const nameEl = document.getElementById('chat-partner-name');
  if (nameEl) nameEl.textContent = activePartner.FullName;

  const statusEl = document.getElementById('chat-partner-status');
  if (statusEl) {
    statusEl.innerHTML = `
      <span class="status-dot ${activePartner.isOnline ? 'online' : 'offline'}"></span>
      <span>${activePartner.isOnline ? 'Online now' : 'Offline'}</span>
    `;
  }
}

function updateRightPanelUI() {
  if (!activePartner) return;
  const avatar = document.getElementById('profile-panel-avatar');
  if (avatar) avatar.src = activePartner.ProfilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(activePartner.FullName)}`;

  const name = document.getElementById('profile-panel-name');
  if (name) name.textContent = activePartner.FullName;

  const username = document.getElementById('profile-panel-username');
  if (username) username.textContent = `@${activePartner.Username}`;

  const bio = document.getElementById('profile-panel-bio');
  if (bio) bio.textContent = activePartner.Bio || 'No bio provided.';

  const location = document.getElementById('profile-panel-location');
  if (location) location.textContent = activePartner.Location || 'Not specified';
}

function showTypingIndicator(show) {
  let indicator = document.getElementById('typing-indicator-bubble');
  const feed = document.getElementById('chat-messages-feed');
  if (!feed) return;

  if (show) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'typing-indicator-bubble';
      indicator.className = 'typing-indicator-box';
      indicator.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 4px;">typing...</span>
      `;
      feed.appendChild(indicator);
      scrollToBottom();
    }
  } else if (indicator) {
    indicator.remove();
  }
}

function markAllSentMessagesAsRead() {
  document.querySelectorAll('.msg-wrapper.sent .msg-meta').forEach(meta => {
    meta.innerHTML = meta.innerHTML.replace(/<span style="color: #94a3b8;" title="Sent">✓<\/span>/g, '<span style="color: #60a5fa;" title="Read">✓✓</span>');
  });
}

function updateConversationSnippet(message) {
  const snippet = document.getElementById(`conv-snippet-${message.ConversationID}`);
  if (snippet) {
    snippet.textContent = message.MessageType === 'image' ? '[Image]' : message.Content;
  }
}

function setupEmojiPicker() {
  const btn = document.getElementById('btn-emoji-toggle');
  const popover = document.getElementById('emoji-popover');
  const input = document.getElementById('chat-input-text');
  if (!btn || !popover || !input) return;

  popover.innerHTML = EMOJIS.map(e => `<button type="button" class="emoji-btn" onclick="insertEmoji('${e}')">${e}</button>`).join('');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    popover.classList.remove('open');
  });
}

function insertEmoji(emoji) {
  const input = document.getElementById('chat-input-text');
  if (input) {
    input.value += emoji;
    input.focus();
  }
}

// Moderation Actions from Chat
async function confirmBlockUser() {
  if (!activePartner) return;
  if (!confirm(`Are you sure you want to block ${activePartner.FullName}? You will no longer receive messages or see their profile.`)) return;

  try {
    await API.friends.blockUser(activePartner.UserID, 'Blocked from chat');
    Utils.showToast('User Blocked', `${activePartner.FullName} has been blocked.`, 'success');
    window.location.href = '/chat.html';
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}

function openReportModal() {
  const modal = document.getElementById('report-user-modal');
  if (modal) modal.classList.add('open');
}

async function submitReportUser() {
  if (!activePartner) return;
  const reason = document.getElementById('report-reason').value;
  const details = document.getElementById('report-details').value.trim();

  try {
    await API.friends.reportUser({
      reportedUserId: activePartner.UserID,
      reason: reason,
      details: details
    });
    Utils.showToast('Report Submitted', 'Our moderation team will review this report.', 'success');
    document.getElementById('report-user-modal').classList.remove('open');
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}

async function confirmDeleteMessage(messageId) {
  const deleteType = confirm('Delete for everyone? Click Cancel to delete only for yourself.') ? 'for_everyone' : 'for_me';
  try {
    await API.chat.deleteMessage(messageId, {
      deleteType: deleteType,
      receiverId: activePartner ? activePartner.UserID : undefined,
      conversationId: activeConversationId
    });

    const msgEl = document.getElementById(`msg-${messageId}`);
    if (msgEl) msgEl.remove();
    Utils.showToast('Deleted', 'Message deleted.', 'info');
  } catch (err) {
    Utils.showToast('Error', err.message, 'error');
  }
}
