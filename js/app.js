/* ============================================================
   Naanga oru Naarikootam — Namba Family
   Client application logic (vanilla JS, no build step)
   ============================================================ */

/* ---------------- Global state ---------------- */
const state = {
  currentUser: null,      // {uid, name, role, color, isAdmin, blocked, isSpectator}
  mode: null,             // 'admin' | 'member' | 'spectate'
  pickedMember: null,     // temp: {uid, name, role, color, authEmail} while entering password
  activeRoom: 'group',
  replyTarget: { group: null, ann: null },
  unsubscribers: [],      // session-level (own profile) — cleared on logout
  viewUnsubscribers: [],  // view-level (dashboard/chat lists) — cleared on view switch too
  heartbeatTimer: null,
  activeMinuteTimer: null,
  presenceRefreshTimer: null,
  recording: { recorder: null, chunks: [], active: false }
};

const EMOJI_LIST = ['😀','😂','🥰','😎','😢','😡','👍','🙏','🎉','❤️','🔥','🦊',
  '😅','😍','🤔','😴','👏','🙌','💜','✨','😇','🤗','😋','🥳','😭','👀','💬','🍽️'];

/* ---------------- Small utilities ---------------- */
function $(id){ return document.getElementById(id); }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

function showToast(msg, isError=false){
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('toast-error', isError);
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=> t.classList.remove('show'), 3200);
}

function openModal(id){ $(id).classList.remove('hidden'); }
function closeModal(id){ $(id).classList.add('hidden'); clearFormErrors(id); }
function clearFormErrors(id){
  qsa('.field-error', $(id)).forEach(e => e.textContent = '');
}

function showView(id){
  qsa('.view').forEach(v => v.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function slugify(name){
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '') || 'member';
}

function nameToEmail(name){
  return `${slugify(name)}@${AUTH_EMAIL_DOMAIN}`;
}

function initials(name){
  return name.trim().split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase();
}

function isEmojiOnly(str){
  const s = str.trim();
  if(!s) return false;
  const stripped = s.replace(
    /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{200D}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\s]/gu,
    ''
  );
  return stripped.length === 0;
}

function formatBytes(bytes){
  if(!bytes) return '0 KB';
  const kb = bytes / 1024;
  if(kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb/1024).toFixed(2)} MB`;
}

function formatMinutes(mins){
  mins = mins || 0;
  if(mins < 60) return `${mins} min`;
  const h = Math.floor(mins/60), m = mins % 60;
  return `${h}h ${m}m`;
}

function formatTime(ts){
  if(!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isOnline(lastActive){
  if(!lastActive) return false;
  const d = lastActive.toDate ? lastActive.toDate() : new Date(lastActive);
  return (Date.now() - d.getTime()) < 45000;
}

/* ---------------- Modal open/close wiring ---------------- */
$('btn-open-admin').addEventListener('click', () => openModal('modal-admin'));
$('btn-open-member').addEventListener('click', () => openModal('modal-member-gate'));
$('btn-open-spectate').addEventListener('click', () => openModal('modal-spectate'));
qsa('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
qsa('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', (e) => { if(e.target === ov) closeModal(ov.id); });
});
$('btn-back-landing-1').addEventListener('click', () => showView('view-landing'));

/* ============================================================
   ADMIN LOGIN
   ============================================================ */
$('form-admin-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('admin-code').value.trim();
  const pass = $('admin-password').value;
  const errEl = $('admin-login-error');
  errEl.textContent = '';

  if(code !== GATE_CODES.adminCode || pass !== GATE_CODES.adminPassword){
    errEl.textContent = 'That code and password combination is not recognized.';
    return;
  }

  try{
    // The admin identity is backed by a real Firebase Auth account
    // (created once during setup — see README Step 3).
    const email = `admin@${AUTH_EMAIL_DOMAIN}`;
    await auth.signInWithEmailAndPassword(email, pass);
    closeModal('modal-admin');
    await loadCurrentUserAndEnter('admin');
  }catch(err){
    console.error(err);
    errEl.textContent = 'Admin account not set up yet in Firebase — see README Step 3.';
  }
});

/* ============================================================
   MEMBER GATE → PICKER
   ============================================================ */
$('form-member-gate').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('family-code').value.trim();
  const pass = $('family-password').value;
  const errEl = $('member-gate-error');
  errEl.textContent = '';

  if(code !== GATE_CODES.familyCode || pass !== GATE_CODES.familyPassword){
    errEl.textContent = 'That family code and password combination is not recognized.';
    return;
  }
  closeModal('modal-member-gate');
  await loadMemberPicker();
  showView('view-member-picker');
});

async function loadMemberPicker(){
  const grid = $('member-picker-grid');
  grid.innerHTML = '<p style="color:var(--lavender-dim);grid-column:1/-1;">Loading the pack…</p>';
  try{
    const snap = await db.collection('directory').orderBy('name').get();
    if(snap.empty){
      grid.innerHTML = '<p style="color:var(--lavender-dim);grid-column:1/-1;">No members added yet. Ask the admin to add the family.</p>';
      return;
    }
    grid.innerHTML = '';
    snap.forEach(doc => {
      const m = doc.data();
      const card = document.createElement('button');
      card.className = 'picker-card';
      card.type = 'button';
      card.disabled = !!m.blocked;
      card.innerHTML = `
        <div class="avatar" style="background:${m.color || '#8b6fd1'}">${initials(m.name)}</div>
        <strong>${escapeHtml(m.name)}</strong>
        <span>${escapeHtml(m.role || '')}</span>
        ${m.blocked ? '<span class="blocked-tag">Blocked</span>' : ''}
      `;
      card.addEventListener('click', () => {
        if(m.blocked){ showToast('This member has been blocked by the admin.', true); return; }
        state.pickedMember = { uid: doc.id, name: m.name, role: m.role, color: m.color, authEmail: m.authEmail };
        $('mp-avatar').style.background = m.color || '#8b6fd1';
        $('mp-avatar').textContent = initials(m.name);
        $('mp-name').textContent = m.name;
        $('mp-role').textContent = m.role || '';
        $('member-password').value = '';
        $('member-password-error').textContent = '';
        openModal('modal-member-password');
      });
      grid.appendChild(card);
    });
  }catch(err){
    console.error(err);
    grid.innerHTML = '<p style="color:var(--danger-bright);grid-column:1/-1;">Could not load members. Check your Firebase setup.</p>';
  }
}

$('form-member-password').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = $('member-password').value;
  const errEl = $('member-password-error');
  errEl.textContent = '';
  if(!state.pickedMember){ return; }
  try{
    await auth.signInWithEmailAndPassword(state.pickedMember.authEmail, pass);
    closeModal('modal-member-password');
    await loadCurrentUserAndEnter('member');
  }catch(err){
    console.error(err);
    errEl.textContent = 'Wrong password. Try again.';
  }
});

/* ============================================================
   SPECTATE LOGIN
   ============================================================ */
$('form-spectate-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = $('spectate-password').value;
  const errEl = $('spectate-login-error');
  errEl.textContent = '';
  if(pass !== GATE_CODES.spectatePassword){
    errEl.textContent = 'That password is not recognized.';
    return;
  }
  try{
    const email = `guest@${AUTH_EMAIL_DOMAIN}`;
    await auth.signInWithEmailAndPassword(email, pass);
    closeModal('modal-spectate');
    await loadCurrentUserAndEnter('spectate');
  }catch(err){
    console.error(err);
    errEl.textContent = 'Guest account not set up yet in Firebase — see README Step 3.';
  }
});

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/* ============================================================
   SESSION: load profile after any successful auth, route user in
   ============================================================ */
async function loadCurrentUserAndEnter(mode){
  const fbUser = auth.currentUser;
  if(!fbUser){ showToast('Something went wrong signing in.', true); return; }

  const docSnap = await db.collection('users').doc(fbUser.uid).get();
  if(!docSnap.exists){
    showToast('No profile found for this account. Ask the admin to check setup.', true);
    await auth.signOut();
    return;
  }
  const data = docSnap.data();
  state.currentUser = {
    uid: fbUser.uid,
    name: data.name,
    role: data.role,
    color: data.color || '#8b6fd1',
    isAdmin: !!data.isAdmin,
    blocked: !!data.blocked,
    isSpectator: !!data.isSpectator
  };
  state.mode = mode;

  startPresenceHeartbeat();
  listenToOwnProfile();

  if(mode === 'admin'){
    enterAdminDashboard();
  } else {
    enterChat();
  }
}

function startPresenceHeartbeat(){
  stopPresenceHeartbeat();
  const uid = state.currentUser.uid;
  const touch = () => {
    db.collection('users').doc(uid).update({ lastActive: firebase.firestore.FieldValue.serverTimestamp() })
      .catch(()=>{});
  };
  touch();
  state.heartbeatTimer = setInterval(touch, 20000);
  state.activeMinuteTimer = setInterval(() => {
    if(document.visibilityState === 'visible'){
      db.collection('users').doc(uid).update({
        activeMinutes: firebase.firestore.FieldValue.increment(1)
      }).catch(()=>{});
    }
  }, 60000);
}
function stopPresenceHeartbeat(){
  clearInterval(state.heartbeatTimer);
  clearInterval(state.activeMinuteTimer);
  state.heartbeatTimer = null;
  state.activeMinuteTimer = null;
}

function listenToOwnProfile(){
  const uid = state.currentUser.uid;
  const unsub = db.collection('users').doc(uid).onSnapshot(snap => {
    if(!snap.exists) return;
    const d = snap.data();
    state.currentUser.blocked = !!d.blocked;
    state.currentUser.isAdmin = !!d.isAdmin;
    updateComposerLockState();
  });
  state.unsubscribers.push(unsub);
}

function detachAllListeners(){
  state.unsubscribers.forEach(u => { try{ u(); }catch(e){} });
  state.unsubscribers = [];
  detachViewListeners();
}
function detachViewListeners(){
  state.viewUnsubscribers.forEach(u => { try{ u(); }catch(e){} });
  state.viewUnsubscribers = [];
  clearInterval(state.presenceRefreshTimer);
  state.presenceRefreshTimer = null;
}

async function fullLogout(){
  detachAllListeners();
  stopPresenceHeartbeat();
  try{ await auth.signOut(); }catch(e){}
  state.currentUser = null;
  state.mode = null;
  state.pickedMember = null;
  state.replyTarget = { group: null, ann: null };
  showView('view-landing');
}

$('btn-admin-logout').addEventListener('click', fullLogout);
$('btn-chat-logout').addEventListener('click', fullLogout);
$('btn-goto-chat-as-admin').addEventListener('click', enterChat);
$('btn-chat-to-admin').addEventListener('click', enterAdminDashboard);


/* ============================================================
   ADMIN DASHBOARD
   ============================================================ */
function enterAdminDashboard(){
  detachViewListeners();
  showView('view-admin-dashboard');
  listenToMemberTable();
  state.presenceRefreshTimer = setInterval(() => {
    db.collection('users').orderBy('name').get().then(snap => renderMemberTable(snap.docs)).catch(()=>{});
  }, 15000);
}

function listenToMemberTable(){
  const unsub = db.collection('users').orderBy('name').onSnapshot(snap => {
    renderMemberTable(snap.docs);
  }, err => console.error(err));
  state.viewUnsubscribers.push(unsub);
}

function renderMemberTable(docs){
  const body = $('member-table-body');
  body.innerHTML = '';
  docs.forEach(doc => {
    const m = doc.data();
    if(m.isSpectator) return; // guest account isn't a "member"
    const tr = document.createElement('tr');
    const online = isOnline(m.lastActive);
    const statusHtml = m.blocked
      ? '<span class="status-pill status-blocked">Blocked</span>'
      : (online ? '<span class="status-pill status-online">Online</span>' : '<span class="status-pill status-offline">Offline</span>');
    tr.innerHTML = `
      <td><strong>${escapeHtml(m.name)}</strong>${m.isAdmin ? ' <span style="color:var(--amber);font-size:11px;">· Admin</span>' : ''}</td>
      <td>${escapeHtml(m.role || '')}</td>
      <td>${m.messageCount || 0}</td>
      <td>${formatBytes(m.storageUsed || 0)}</td>
      <td>${formatMinutes(m.activeMinutes || 0)}</td>
      <td>${statusHtml}</td>
      <td class="row-actions">
        <button class="icon-action" data-edit="${doc.id}">Edit</button>
        <button class="icon-action" data-block="${doc.id}" data-blocked="${!!m.blocked}">${m.blocked ? 'Unblock' : 'Block'}</button>
      </td>
    `;
    body.appendChild(tr);
  });

  qsa('[data-edit]', body).forEach(btn => btn.addEventListener('click', () => openEditMember(btn.dataset.edit)));
  qsa('[data-block]', body).forEach(btn => btn.addEventListener('click', () => {
    const uid = btn.dataset.block;
    const currentlyBlocked = btn.dataset.blocked === 'true';
    db.collection('users').doc(uid).update({ blocked: !currentlyBlocked })
      .then(()=> showToast(currentlyBlocked ? 'Member unblocked.' : 'Member blocked from messaging.'))
      .catch(err => showToast(err.message, true));
  }));
}

/* ---- Delete all group chat messages ---- */
$('btn-delete-all-chats').addEventListener('click', async () => {
  if(!confirm('This deletes every Group Chat message for everyone. Continue?')) return;
  const statusEl = $('delete-chats-status');
  statusEl.textContent = 'Deleting…';
  try{
    await deleteAllDocsInCollection('messages_group');
    statusEl.textContent = 'All group chat messages deleted.';
    showToast('Group chat cleared.');
  }catch(err){
    console.error(err);
    statusEl.textContent = 'Something went wrong.';
    showToast(err.message, true);
  }
});

async function deleteAllDocsInCollection(name){
  const snap = await db.collection(name).get();
  const chunks = [];
  let batch = db.batch(); let count = 0;
  snap.docs.forEach(d => {
    batch.delete(d.ref); count++;
    if(count === 450){ chunks.push(batch); batch = db.batch(); count = 0; }
  });
  chunks.push(batch);
  for(const b of chunks){ await b.commit(); }
}

/* ---- Add / Edit member ---- */
$('btn-open-add-member').addEventListener('click', () => {
  $('member-form-title').textContent = 'Add Member';
  $('member-form-submit').textContent = 'Add to the Pack';
  $('mf-uid').value = '';
  $('mf-name').value = '';
  $('mf-role').value = '';
  $('mf-password').value = '';
  $('mf-password-label').firstChild.textContent = 'Password ';
  $('mf-password').required = true;
  $('mf-color').value = '#8b6fd1';
  $('mf-is-admin').checked = false;
  $('member-form-error').textContent = '';
  openModal('modal-member-form');
});

function openEditMember(uid){
  db.collection('users').doc(uid).get().then(snap => {
    const m = snap.data();
    $('member-form-title').textContent = `Edit ${m.name}`;
    $('member-form-submit').textContent = 'Save Changes';
    $('mf-uid').value = uid;
    $('mf-name').value = m.name;
    $('mf-role').value = m.role || '';
    $('mf-password').value = '';
    $('mf-password-label').firstChild.textContent = 'New password (optional) ';
    $('mf-password').required = false;
    $('mf-color').value = m.color || '#8b6fd1';
    $('mf-is-admin').checked = !!m.isAdmin;
    $('member-form-error').textContent = '';
    openModal('modal-member-form');
  });
}

$('form-member-editor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const uid = $('mf-uid').value;
  const name = $('mf-name').value.trim();
  const role = $('mf-role').value.trim();
  const password = $('mf-password').value;
  const color = $('mf-color').value;
  const isAdmin = $('mf-is-admin').checked;
  const errEl = $('member-form-error');
  errEl.textContent = '';

  if(!name || !role){ errEl.textContent = 'Name and role are required.'; return; }

  try{
    if(uid){
      // Edit existing member
      await db.collection('users').doc(uid).update({ name, role, color, isAdmin });
      await db.collection('directory').doc(uid).update({ name, role, color });
      if(password){
        await changeMemberPasswordViaFunction(uid, password);
      }
      showToast('Member updated.');
    } else {
      // Add new member — creates a real Firebase Auth account via the
      // secondary app instance, so the admin session is undisturbed.
      if(!password){ errEl.textContent = 'A password is required for a new member.'; return; }
      const email = nameToEmail(name);
      const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
      const newUid = cred.user.uid;
      await secondaryAuth.signOut();

      await db.collection('users').doc(newUid).set({
        name, role, color, isAdmin, blocked: false, isSpectator: false,
        authEmail: email, messageCount: 0, storageUsed: 0, activeMinutes: 0,
        lastActive: null, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('directory').doc(newUid).set({ name, role, color, blocked: false, authEmail: email });
      showToast(`${name} added to the pack.`);
    }
    closeModal('modal-member-form');
  }catch(err){
    console.error(err);
    errEl.textContent = err.message || 'Something went wrong.';
  }
});

/* Password changes for an EXISTING member require Admin SDK privileges,
   which a static client app cannot hold safely. This calls the optional
   Cloud Function described in README Step 5. If it isn't deployed, we
   fail gracefully and tell the admin the supported fallback. */
async function changeMemberPasswordViaFunction(uid, newPassword){
  try{
    const fn = firebase.app().functions ? firebase.app().functions() : null;
    if(!fn) throw new Error('Cloud Functions not configured.');
    const callable = fn.httpsCallable('changeMemberPassword');
    await callable({ uid, newPassword });
  }catch(err){
    throw new Error(
      'Password change needs the optional Cloud Function from README Step 5. ' +
      'Until that is deployed, remove and re-add this member with the new password instead.'
    );
  }
}

/* ============================================================
   CHAT APP
   ============================================================ */
function enterChat(){
  detachViewListeners();
  showView('view-chat');
  $('sidebar-session-label').textContent =
    state.mode === 'spectate' ? 'Spectating' : `${state.currentUser.role} · ${state.currentUser.name}`;
  $('btn-chat-to-admin').classList.toggle('hidden', !(state.currentUser && state.currentUser.isAdmin));

  updateComposerLockState();
  listenToMembersSidebar();
  listenToGroupMessages();
  listenToAnnouncements();
  switchRoom('members');
}

/* ---- Tabs ---- */
qsa('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', () => switchRoom(tab.dataset.tab));
});
function switchRoom(tab){
  qsa('.sidebar-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('panel-members').classList.toggle('hidden', tab !== 'members');
  qsa('.room').forEach(r => r.classList.remove('active'));
  if(tab === 'group') $('room-group').classList.add('active');
  if(tab === 'announcements') $('room-announcements').classList.add('active');
  state.activeRoom = tab;
}

/* ---- Members sidebar list ---- */
function listenToMembersSidebar(){
  const unsub = db.collection('users').orderBy('name').onSnapshot(snap => {
    const list = $('members-list');
    list.innerHTML = '';
    snap.forEach(doc => {
      const m = doc.data();
      if(m.isSpectator) return;
      const online = isOnline(m.lastActive);
      const row = document.createElement('div');
      row.className = 'member-row';
      row.innerHTML = `
        <div class="avatar" style="background:${m.color || '#8b6fd1'}">
          ${initials(m.name)}
          <span class="presence-dot ${online ? 'presence-online' : 'presence-offline'}"></span>
        </div>
        <div class="member-row-text">
          <strong>${escapeHtml(m.name)}${m.isAdmin ? ' 🦊' : ''}</strong>
          <span>${escapeHtml(m.role || '')}${m.blocked ? ' · blocked' : ''}</span>
        </div>
      `;
      list.appendChild(row);
    });
  });
  state.viewUnsubscribers.push(unsub);
}

function updateComposerLockState(){
  const blocked = state.mode !== 'spectate' && state.currentUser && state.currentUser.blocked;
  const spectating = state.mode === 'spectate';
  const groupForm = $('form-group-composer');
  qsa('input, button', groupForm).forEach(el => el.disabled = blocked || spectating);
  if(blocked) showToast('You have been blocked from sending messages.', true);

  const isAdmin = state.currentUser && state.currentUser.isAdmin;
  $('form-announcement-composer').classList.toggle('hidden', !isAdmin || spectating);
  $('announcements-locked-note').classList.toggle('hidden', !!isAdmin || spectating);
  $('btn-delete-all-announcements').classList.toggle('hidden', !isAdmin);
}

/* ============================================================
   GROUP CHAT
   ============================================================ */
function listenToGroupMessages(){
  const unsub = db.collection('messages_group').orderBy('createdAt', 'asc').limitToLast(200)
    .onSnapshot(snap => renderMessages(snap.docs, 'messages-group', 'group'), err => console.error(err));
  state.viewUnsubscribers.push(unsub);
}

function renderMessages(docs, containerId, room){
  const el = $(containerId);
  const wasAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
  el.innerHTML = '';
  docs.forEach(doc => {
    const m = doc.data();
    const mine = state.currentUser && m.senderId === state.currentUser.uid;
    const wrap = document.createElement('div');
    wrap.className = 'msg' + (mine ? ' mine' : '');

    let bubbleInner = '';
    if(m.replyTo){
      bubbleInner += `<div class="msg-quote"><strong>${escapeHtml(m.replyTo.senderName)}</strong><br>${escapeHtml(m.replyTo.text)}</div>`;
    }
    if(m.type === 'image'){
      bubbleInner += `<img class="msg-image" src="${m.imageUrl}" alt="attachment">`;
      if(m.text) bubbleInner += `<div>${escapeHtml(m.text)}</div>`;
    } else if(m.type === 'voice'){
      bubbleInner += `<audio class="msg-audio" controls src="${m.audioUrl}"></audio>`;
    } else {
      bubbleInner += escapeHtml(m.text || '');
    }

    let reactionsHtml = '';
    if(m.reactions && Object.keys(m.reactions).length){
      const counts = {};
      Object.values(m.reactions).forEach(r => { counts[r.emoji] = (counts[r.emoji]||0) + 1; });
      reactionsHtml = '<div class="msg-reactions">' +
        Object.entries(counts).map(([emoji,c]) => `<span class="reaction-chip">${emoji} ${c>1?c:''}</span>`).join('') +
        '</div>';
    }

    const canReply = room === 'group' && state.mode !== 'spectate';
    wrap.innerHTML = `
      <span class="msg-meta">${!mine ? escapeHtml(m.senderName) + ' · ' : ''}${formatTime(m.createdAt)}</span>
      <div class="msg-bubble">${bubbleInner}</div>
      ${reactionsHtml}
      ${canReply ? `<div class="msg-actions"><button class="msg-action-btn" data-reply="${doc.id}" data-room="${room}">Reply</button></div>` : ''}
    `;
    el.appendChild(wrap);
  });

  qsa('[data-reply]', el).forEach(btn => btn.addEventListener('click', () => {
    const doc = docs.find(d => d.id === btn.dataset.reply);
    if(!doc) return;
    const m = doc.data();
    setReplyTarget(room, { id: doc.id, text: m.text || (m.type === 'image' ? '📷 Photo' : m.type === 'voice' ? '🎙️ Voice message' : ''), senderName: m.senderName });
  }));

  if(wasAtBottom) el.scrollTop = el.scrollHeight;
}

function setReplyTarget(room, target){
  state.replyTarget[room] = target;
  const previewId = room === 'group' ? 'reply-preview-group' : 'reply-preview-ann';
  const nameId = room === 'group' ? 'reply-preview-name-group' : 'reply-preview-name-ann';
  const textId = room === 'group' ? 'reply-preview-text-group' : 'reply-preview-text-ann';
  if($(previewId)){
    $(nameId).textContent = target.senderName;
    $(textId).textContent = target.text;
    $(previewId).classList.remove('hidden');
  }
}
$('reply-cancel-group').addEventListener('click', () => {
  state.replyTarget.group = null;
  $('reply-preview-group').classList.add('hidden');
});

$('form-group-composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  if(state.mode === 'spectate') return;
  const input = $('input-group');
  const text = input.value.trim();
  if(!text) return;
  if(state.currentUser.blocked){ showToast('You have been blocked from sending messages.', true); return; }

  const replyTo = state.replyTarget.group;

  try{
    if(replyTo && isEmojiOnly(text)){
      // Emoji-only reply becomes a reaction on the original message, WhatsApp-style
      await db.collection('messages_group').doc(replyTo.id).update({
        [`reactions.${state.currentUser.uid}`]: { emoji: text, name: state.currentUser.name }
      });
    } else {
      await db.collection('messages_group').add({
        senderId: state.currentUser.uid,
        senderName: state.currentUser.name,
        text,
        type: 'text',
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderName: replyTo.senderName } : null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('users').doc(state.currentUser.uid).update({
        messageCount: firebase.firestore.FieldValue.increment(1)
      });
    }
    input.value = '';
    state.replyTarget.group = null;
    $('reply-preview-group').classList.add('hidden');
  }catch(err){
    console.error(err);
    showToast(err.message, true);
  }
});

/* ---- Emoji picker (shared logic for group + announcements) ---- */
function wireEmojiPicker(buttonId, pickerId, inputId){
  const picker = $(pickerId);
  picker.innerHTML = EMOJI_LIST.map(e => `<button type="button">${e}</button>`).join('');
  $(buttonId).addEventListener('click', () => picker.classList.toggle('hidden'));
  qsa('button', picker).forEach(b => b.addEventListener('click', () => {
    $(inputId).value += b.textContent;
    $(inputId).focus();
  }));
  document.addEventListener('click', (e) => {
    if(!picker.contains(e.target) && e.target.id !== buttonId) picker.classList.add('hidden');
  });
}
wireEmojiPicker('btn-emoji-group', 'emoji-picker-group', 'input-group');
wireEmojiPicker('btn-emoji-ann', 'emoji-picker-ann', 'input-announcement');

/* ============================================================
   ANNOUNCEMENTS (admin-only posting)
   ============================================================ */
function listenToAnnouncements(){
  const unsub = db.collection('messages_announcements').orderBy('createdAt', 'asc').limitToLast(200)
    .onSnapshot(snap => renderMessages(snap.docs, 'messages-announcements', 'announcements'), err => console.error(err));
  state.viewUnsubscribers.push(unsub);
}

$('form-announcement-composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!state.currentUser.isAdmin) return;
  const input = $('input-announcement');
  const text = input.value.trim();
  if(!text) return;
  try{
    await postAnnouncement({ type: 'text', text });
    input.value = '';
  }catch(err){
    showToast(err.message, true);
  }
});

$('input-ann-image').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file || !state.currentUser.isAdmin) return;
  try{
    showToast('Uploading photo…');
    const path = `announcements/images/${Date.now()}-${state.currentUser.uid}-${file.name}`;
    const ref = storage.ref(path);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    await postAnnouncement({ type: 'image', imageUrl: url, fileSize: file.size, storagePath: path });
    showToast('Photo sent.');
  }catch(err){
    console.error(err);
    showToast(err.message, true);
  } finally {
    e.target.value = '';
  }
});

$('btn-ann-voice').addEventListener('click', async () => {
  if(!state.currentUser.isAdmin) return;
  const btn = $('btn-ann-voice');
  if(!state.recording.active){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      state.recording.recorder = recorder;
      state.recording.chunks = [];
      recorder.ondataavailable = (ev) => state.recording.chunks.push(ev.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(state.recording.chunks, { type: 'audio/webm' });
        try{
          showToast('Uploading voice message…');
          const path = `announcements/audio/${Date.now()}-${state.currentUser.uid}.webm`;
          const ref = storage.ref(path);
          await ref.put(blob);
          const url = await ref.getDownloadURL();
          await postAnnouncement({ type: 'voice', audioUrl: url, fileSize: blob.size, storagePath: path });
          showToast('Voice message sent.');
        }catch(err){
          console.error(err);
          showToast(err.message, true);
        }
      };
      recorder.start();
      state.recording.active = true;
      btn.classList.add('recording');
      btn.textContent = '⏹️';
    }catch(err){
      console.error(err);
      showToast('Microphone access was blocked or unavailable.', true);
    }
  } else {
    state.recording.recorder.stop();
    state.recording.active = false;
    btn.classList.remove('recording');
    btn.textContent = '🎙️';
  }
});

async function postAnnouncement(payload){
  await db.collection('messages_announcements').add({
    senderId: state.currentUser.uid,
    senderName: state.currentUser.name,
    text: payload.text || '',
    type: payload.type,
    imageUrl: payload.imageUrl || null,
    audioUrl: payload.audioUrl || null,
    storagePath: payload.storagePath || null,
    fileSize: payload.fileSize || 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await db.collection('users').doc(state.currentUser.uid).update({
    messageCount: firebase.firestore.FieldValue.increment(1),
    storageUsed: firebase.firestore.FieldValue.increment(payload.fileSize || 0)
  });
}

$('btn-delete-all-announcements').addEventListener('click', async () => {
  if(!state.currentUser.isAdmin) return;
  if(!confirm('This deletes every announcement (including photos and voice messages) for everyone. Continue?')) return;
  try{
    const snap = await db.collection('messages_announcements').get();
    // Free up Storage first
    const deletions = [];
    snap.forEach(doc => {
      const m = doc.data();
      if(m.storagePath) deletions.push(storage.ref(m.storagePath).delete().catch(()=>{}));
    });
    await Promise.all(deletions);
    await deleteAllDocsInCollection('messages_announcements');
    showToast('All announcements cleared.');
  }catch(err){
    console.error(err);
    showToast(err.message, true);
  }
});

/* ---------------- Boot ---------------- */
// If Firebase config hasn't been filled in yet, tell the developer clearly
// rather than failing silently with a confusing console error.
(function checkConfig(){
  if(firebaseConfig.apiKey === 'PASTE_YOUR_API_KEY'){
    console.warn('[Naarikootam] Firebase config is still using placeholder values. See README.md Step 1.');
  }
})();

/* ============================================================
   SESSION RESTORE ON PAGE RELOAD
   Firebase Auth persists sessions in the browser. If the page is
   refreshed while someone is logged in, drop them back into chat
   instead of the landing page. Only runs on the very first auth
   check of a page load — explicit login flows above handle
   routing themselves after that.
   ============================================================ */
let bootPhase = true;
auth.onAuthStateChanged(async (fbUser) => {
  if(!bootPhase) return;
  bootPhase = false;
  if(!fbUser) return; // no session — stay on landing

  try{
    const docSnap = await db.collection('users').doc(fbUser.uid).get();
    if(!docSnap.exists){ await auth.signOut(); return; }
    const data = docSnap.data();
    state.currentUser = {
      uid: fbUser.uid, name: data.name, role: data.role,
      color: data.color || '#8b6fd1', isAdmin: !!data.isAdmin,
      blocked: !!data.blocked, isSpectator: !!data.isSpectator
    };
    state.mode = data.isSpectator ? 'spectate' : 'member';
    startPresenceHeartbeat();
    listenToOwnProfile();
    enterChat();
  }catch(err){
    console.error(err);
  }
});
