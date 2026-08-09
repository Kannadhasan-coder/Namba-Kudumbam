// Namba Family — chat logic (Firebase Realtime Database)

const currentUserRaw = localStorage.getItem('nf_currentUser');
if (!currentUserRaw) {
  window.location.href = 'login.html';
}
const currentUser = JSON.parse(currentUserRaw);

document.getElementById('myAvatar').src = currentUser.photo;

const messagesArea = document.getElementById('messagesArea');
const emptyState = document.getElementById('emptyState');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPop = document.getElementById('emojiPop');
const onlineStrip = document.getElementById('onlineStrip');
const onlineCountText = document.getElementById('onlineCountText');
const logoutBtn = document.getElementById('logoutBtn');
const toastEl = document.getElementById('toast');

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ---------------- Presence ---------------- */

const myPresenceRef = db.ref('presence/' + currentUser.id);

db.ref('.info/connected').on('value', (snap) => {
  if (snap.val() === true) {
    myPresenceRef.onDisconnect().set({
      online: false,
      name: currentUser.name,
      photo: currentUser.photo,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
    myPresenceRef.set({
      online: true,
      name: currentUser.name,
      photo: currentUser.photo,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
  }
});

db.ref('presence').on('value', (snap) => {
  const data = snap.val() || {};
  const onlineUsers = Object.entries(data).filter(([_, v]) => v.online);

  onlineCountText.textContent = onlineUsers.length > 0
    ? `${onlineUsers.length} online`
    : 'no one online';

  onlineStrip.innerHTML = '';
  onlineUsers.forEach(([id, v]) => {
    const chip = document.createElement('div');
    chip.className = 'online-chip';
    chip.innerHTML = `<img src="${v.photo}" alt=""><span>${v.name}</span>`;
    onlineStrip.appendChild(chip);
  });
});

/* ---------------- Messages ---------------- */

const messagesRef = db.ref('messages').orderByChild('timestamp');
let renderedIds = new Set();
let lastDateLabel = '';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return 'Today';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderMessage(id, msg) {
  if (renderedIds.has(id)) return;
  renderedIds.add(id);
  emptyState.style.display = 'none';

  const dateLabel = formatDateLabel(msg.timestamp);
  if (dateLabel !== lastDateLabel) {
    lastDateLabel = dateLabel;
    const divider = document.createElement('div');
    divider.className = 'day-divider';
    divider.textContent = dateLabel;
    messagesArea.appendChild(divider);
  }

  const isMine = msg.senderId === currentUser.id;
  const row = document.createElement('div');
  row.className = 'msg-row' + (isMine ? ' mine' : '');
  row.dataset.id = id;

  row.innerHTML = `
    <div class="avatar-mini"><img src="${msg.senderPhoto}" alt=""></div>
    <div class="msg-content">
      <div class="msg-sender">${msg.senderName}</div>
      <div class="msg-bubble"></div>
      <div class="msg-meta">
        <span>${formatTime(msg.timestamp)}</span>
        ${isMine ? '<button class="msg-delete">delete</button>' : ''}
      </div>
    </div>
  `;

  // set text safely (no HTML injection)
  row.querySelector('.msg-bubble').textContent = msg.text;

  if (isMine) {
    row.querySelector('.msg-delete').addEventListener('click', () => {
      db.ref('messages/' + id).remove().then(() => showToast('Message delete aachu'));
    });
  }

  messagesArea.appendChild(row);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

messagesRef.on('child_added', (snap) => {
  renderMessage(snap.key, snap.val());
});

messagesRef.on('child_removed', (snap) => {
  const row = messagesArea.querySelector(`[data-id="${snap.key}"]`);
  if (row) row.remove();
  renderedIds.delete(snap.key);
});

/* ---------------- Sending ---------------- */

function autoResize() {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 90) + 'px';
}
msgInput.addEventListener('input', autoResize);

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  db.ref('messages').push({
    text,
    senderId: currentUser.id,
    senderName: currentUser.name,
    senderPhoto: currentUser.photo,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });

  msgInput.value = '';
  autoResize();
  emojiPop.classList.remove('show');
}

sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

/* ---------------- Emoji picker ---------------- */

const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😉','😎','🤗',
  '🥰','😇','🙂','😅','😆','😜','🤩','🥳','😢','😭',
  '😡','😴','🤔','😳','😱','🙏','👍','👎','👏','🙌',
  '💪','❤️','💜','💛','💚','💙','🧡','✨','🔥','🎉',
  '🌸','🌟','☀️','🌙','🍛','🍽️','☕','🎂','🙏🏽','😴'
];

EMOJIS.forEach((emo) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = emo;
  b.addEventListener('click', () => {
    msgInput.value += emo;
    msgInput.focus();
    autoResize();
  });
  emojiPop.appendChild(b);
});

emojiBtn.addEventListener('click', () => {
  emojiPop.classList.toggle('show');
});

document.addEventListener('click', (e) => {
  if (!emojiPop.contains(e.target) && e.target !== emojiBtn) {
    emojiPop.classList.remove('show');
  }
});

/* ---------------- Logout ---------------- */

logoutBtn.addEventListener('click', () => {
  myPresenceRef.set({
    online: false,
    name: currentUser.name,
    photo: currentUser.photo,
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  }).finally(() => {
    localStorage.removeItem('nf_currentUser');
    window.location.href = 'login.html';
  });
});
