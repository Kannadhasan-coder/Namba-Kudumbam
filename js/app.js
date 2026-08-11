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
  recording: { recorder: null, chunks: [], active: false, timeoutId: null }
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

/* Renders a member's avatar: their photo (admin-set) if present, otherwise
   initials on their profile color. innerExtra lets callers nest something
   inside (e.g. a presence dot) regardless of which variant renders. */
function avatarMarkup(m, className = 'avatar', innerExtra = ''){
  const style = m.photoData
    ? `background-image:url('${m.photoData}');background-size:cover;background-position:center;`
    : `background:${m.color || '#8b6fd1'};`;
  const content = m.photoData ? '' : initials(m.name);
  return `<div class="${className}" style="${style}">${content}${innerExtra}</div>`;
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

  if(code !== GATE_CODES.adminCode){
    errEl.textContent = 'That admin code is not recognized.';
    return;
  }

  try{
    // The admin identity is backed by a real Firebase Auth account
    // (created once during setup — see README Step 3). Firebase itself
    // verifies the password here (not a stale local copy), so using
    // "Change Password" later never breaks this login.
    const email = `admin@${AUTH_EMAIL_DOMAIN}`;
    await auth.signInWithEmailAndPassword(email, pass);
    closeModal('modal-admin');
    await loadCurrentUserAndEnter('admin');
  }catch(err){
    console.error(err);
    errEl.textContent = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
      ? 'Wrong password.'
      : 'Admin account not set up yet in Firebase — see README Step 3.';
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
        ${avatarMarkup(m, 'avatar')}
        <strong>${escapeHtml(m.name)}</strong>
        <span>${escapeHtml(m.role || '')}</span>
        ${m.blocked ? '<span class="blocked-tag">Blocked</span>' : ''}
      `;
      card.addEventListener('click', () => {
        if(m.blocked){ showToast('This member has been blocked by the admin.', true); return; }
        state.pickedMember = { uid: doc.id, name: m.name, role: m.role, color: m.color, authEmail: m.authEmail };
        const mpAvatar = $('mp-avatar');
        if(m.photoData){
          mpAvatar.style.backgroundImage = `url('${m.photoData}')`;
          mpAvatar.style.backgroundSize = 'cover';
          mpAvatar.style.backgroundPosition = 'center';
          mpAvatar.textContent = '';
        } else {
          mpAvatar.style.backgroundImage = 'none';
          mpAvatar.style.background = m.color || '#8b6fd1';
          mpAvatar.textContent = initials(m.name);
        }
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

  const currentSpectatePassword = await getSpectatePassword();
  if(pass !== currentSpectatePassword){
    errEl.textContent = 'That password is not recognized.';
    return;
  }
  try{
    // Sign in with the fixed internal Firebase Auth password (set once,
    // never changes) — NOT the word the visitor just typed. This means
    // the admin can change the spectator password anytime from Admin
    // Dashboard without ever touching Firebase Console or GitHub.
    const email = `guest@${AUTH_EMAIL_DOMAIN}`;
    await auth.signInWithEmailAndPassword(email, GUEST_AUTH_PASSWORD);
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

/* The Spectate gate password lives in Firestore (settings/spectate) so the
   admin can change it from Admin Dashboard, with no code edits or
   redeploys. Publicly readable (see firestore.rules) since visitors check
   it before they're signed in. Falls back to the built-in default the
   very first time, before the admin has ever saved a custom one. */
async function getSpectatePassword(){
  try{
    const snap = await db.collection('settings').doc('spectate').get();
    if(snap.exists && snap.data().password) return snap.data().password;
  }catch(err){
    console.error(err);
  }
  return GATE_CODES.spectatePassword;
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
  getSpectatePassword().then(pw => { $('spectate-password-input').value = pw; });
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
      <td><span style="display:inline-flex;align-items:center;gap:8px;">${avatarMarkup(m, 'avatar table-avatar')}<strong>${escapeHtml(m.name)}</strong>${m.isAdmin ? ' <span style="color:var(--amber);font-size:11px;">· Admin</span>' : ''}</span></td>
      <td>${escapeHtml(m.role || '')}</td>
      <td>${m.messageCount || 0}</td>
      <td>${formatBytes(m.storageUsed || 0)}</td>
      <td>${formatMinutes(m.activeMinutes || 0)}</td>
      <td>${statusHtml}</td>
      <td class="row-actions">
        <button class="icon-action" data-edit="${doc.id}">Edit</button>
        <button class="icon-action" data-block="${doc.id}" data-blocked="${!!m.blocked}">${m.blocked ? 'Unblock' : 'Block'}</button>
        ${!m.isAdmin ? `<button class="icon-action danger" data-delete-member="${doc.id}" data-name="${escapeHtml(m.name)}">Delete</button>` : ''}
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
  qsa('[data-delete-member]', body).forEach(btn => btn.addEventListener('click', async () => {
    const uid = btn.dataset.deleteMember;
    const name = btn.dataset.name;
    if(!confirm(`Remove ${name} from the family? They won't be able to log in anymore. This can't be undone from here.`)) return;
    try{
      await db.collection('directory').doc(uid).delete();
      await db.collection('users').doc(uid).delete();
      showToast(`${name} removed.`);
    }catch(err){
      console.error(err);
      showToast(err.message, true);
    }
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

/* ---- Spectator (guest) gate password — stored in Firestore so it's
   editable right here, no code edits or redeploys needed ---- */
$('form-spectate-password').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = $('spectate-password-status');
  const newPass = $('spectate-password-input').value.trim();
  if(!newPass){ statusEl.textContent = 'Password can\'t be empty.'; return; }
  statusEl.textContent = 'Saving…';
  try{
    await db.collection('settings').doc('spectate').set({ password: newPass }, { merge: true });
    statusEl.textContent = 'Spectator password updated.';
    showToast('Spectator password updated.');
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
let pendingMemberPhoto = null; // holds a newly-compressed photo (data URL) before submit

$('mf-photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    pendingMemberPhoto = await compressImageToDataUrl(file, 300, 0.7);
    const preview = $('mf-photo-preview');
    preview.style.backgroundImage = `url('${pendingMemberPhoto}')`;
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
    preview.textContent = '';
    $('mf-photo-preview-row').classList.remove('hidden');
    $('mf-remove-photo-row').classList.add('hidden');
  }catch(err){
    console.error(err);
    showToast('Could not process that photo.', true);
  } finally {
    e.target.value = '';
  }
});

$('btn-open-add-member').addEventListener('click', () => {
  $('member-form-title').textContent = 'Add Member';
  $('member-form-submit').textContent = 'Add to the Pack';
  $('mf-uid').value = '';
  $('mf-name').value = '';
  $('mf-role').value = '';
  $('mf-password').value = '';
  $('mf-password-row').classList.remove('hidden');
  $('mf-password-hint').classList.add('hidden');
  $('mf-password').required = true;
  $('mf-color').value = '#8b6fd1';
  $('mf-is-admin').checked = false;
  pendingMemberPhoto = null;
  $('mf-photo-preview-row').classList.add('hidden');
  $('mf-remove-photo').checked = false;
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
    $('mf-password-row').classList.add('hidden');
    $('mf-password-hint').classList.remove('hidden');
    $('mf-password').required = false;
    $('mf-color').value = m.color || '#8b6fd1';
    $('mf-is-admin').checked = !!m.isAdmin;
    pendingMemberPhoto = null;
    $('mf-remove-photo').checked = false;
    if(m.photoData){
      const preview = $('mf-photo-preview');
      preview.style.backgroundImage = `url('${m.photoData}')`;
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
      preview.textContent = '';
      $('mf-photo-preview-row').classList.remove('hidden');
      $('mf-remove-photo-row').classList.remove('hidden');
    } else {
      $('mf-photo-preview-row').classList.add('hidden');
    }
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
  const removePhoto = $('mf-remove-photo').checked;
  const errEl = $('member-form-error');
  errEl.textContent = '';

  if(!name || !role){ errEl.textContent = 'Name and role are required.'; return; }

  try{
    if(uid){
      // Edit existing member — name/role/color/admin/photo. Passwords can't
      // be set by anyone but the account owner (see "Change Password" in
      // the chat sidebar) without a paid Cloud Function.
      const update = { name, role, color, isAdmin };
      if(pendingMemberPhoto) update.photoData = pendingMemberPhoto;
      else if(removePhoto) update.photoData = null;
      await db.collection('users').doc(uid).update(update);
      const dirUpdate = { name, role, color };
      if(pendingMemberPhoto) dirUpdate.photoData = pendingMemberPhoto;
      else if(removePhoto) dirUpdate.photoData = null;
      await db.collection('directory').doc(uid).update(dirUpdate);
      showToast('Member updated.');
    } else {
      // Add new member — creates a real Firebase Auth account via the
      // secondary app instance, so the admin session is undisturbed.
      if(!password){ errEl.textContent = 'A password is required for a new member.'; return; }
      const email = nameToEmail(name);
      const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
      const newUid = cred.user.uid;
      await secondaryAuth.signOut();

      const newUser = {
        name, role, color, isAdmin, blocked: false, isSpectator: false,
        authEmail: email, messageCount: 0, storageUsed: 0, activeMinutes: 0,
        lastActive: null, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      const newDir = { name, role, color, blocked: false, authEmail: email };
      if(pendingMemberPhoto){ newUser.photoData = pendingMemberPhoto; newDir.photoData = pendingMemberPhoto; }
      await db.collection('users').doc(newUid).set(newUser);
      await db.collection('directory').doc(newUid).set(newDir);
      showToast(`${name} added to the pack.`);
    }
    closeModal('modal-member-form');
  }catch(err){
    console.error(err);
    errEl.textContent = err.message || 'Something went wrong.';
  }
});

/* ============================================================
   SELF-SERVICE PASSWORD CHANGE
   Only the signed-in account owner can change their own password —
   this is a real Firebase Auth operation that works on the free plan
   (unlike admin-changing-someone-else's-password, which needs a paid
   Cloud Function). Available from the chat sidebar once logged in.
   ============================================================ */
$('btn-change-password').addEventListener('click', () => {
  $('cp-current').value = '';
  $('cp-new').value = '';
  $('cp-confirm').value = '';
  $('change-password-error').textContent = '';
  openModal('modal-change-password');
});

$('form-change-password').addEventListener('submit', async (e) => {
  e.preventDefault();
  const current = $('cp-current').value;
  const next = $('cp-new').value;
  const confirmPass = $('cp-confirm').value;
  const errEl = $('change-password-error');
  errEl.textContent = '';

  if(next.length < 6){ errEl.textContent = 'New password must be at least 6 characters.'; return; }
  if(next !== confirmPass){ errEl.textContent = 'New passwords don\'t match.'; return; }

  try{
    const user = auth.currentUser;
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, current);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(next);
    closeModal('modal-change-password');
    showToast('Password changed.');
  }catch(err){
    console.error(err);
    errEl.textContent = err.code === 'auth/wrong-password'
      ? 'Current password is incorrect.'
      : (err.message || 'Could not change password.');
  }
});

/* ============================================================
   CHAT APP
   ============================================================ */
function enterChat(){
  detachViewListeners();
  showView('view-chat');
  $('sidebar-session-label').textContent =
    state.mode === 'spectate' ? 'Spectating' : `${state.currentUser.role} · ${state.currentUser.name}`;
  $('btn-chat-to-admin').classList.toggle('hidden', !(state.currentUser && state.currentUser.isAdmin));
  $('btn-change-password').classList.toggle('hidden', state.mode === 'spectate');

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
        ${avatarMarkup(m, 'avatar', `<span class="presence-dot ${online ? 'presence-online' : 'presence-offline'}"></span>`)}
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
      bubbleInner += `<img class="msg-image" src="${m.imageData}" alt="attachment">`;
      if(m.text) bubbleInner += `<div>${escapeHtml(m.text)}</div>`;
    } else if(m.type === 'voice'){
      bubbleInner += `<audio class="msg-audio" controls src="${m.audioData}"></audio>`;
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
    const canDelete = room === 'group' && state.mode !== 'spectate'
                       && (mine || (state.currentUser && state.currentUser.isAdmin));
    const actionsHtml = (canReply || canDelete)
      ? `<div class="msg-actions">
           ${canReply ? `<button class="msg-action-btn" data-reply="${doc.id}" data-room="${room}">Reply</button>` : ''}
           ${canDelete ? `<button class="msg-action-btn msg-action-delete" data-delete="${doc.id}" data-room="${room}">Delete</button>` : ''}
         </div>`
      : '';
    wrap.innerHTML = `
      <span class="msg-meta">${!mine ? escapeHtml(m.senderName) + ' · ' : ''}${formatTime(m.createdAt)}</span>
      <div class="msg-bubble">${bubbleInner}</div>
      ${reactionsHtml}
      ${actionsHtml}
    `;
    el.appendChild(wrap);
  });

  qsa('[data-reply]', el).forEach(btn => btn.addEventListener('click', () => {
    const doc = docs.find(d => d.id === btn.dataset.reply);
    if(!doc) return;
    const m = doc.data();
    setReplyTarget(room, { id: doc.id, text: m.text || (m.type === 'image' ? '📷 Photo' : m.type === 'voice' ? '🎙️ Voice message' : ''), senderName: m.senderName });
  }));

  qsa('[data-delete]', el).forEach(btn => btn.addEventListener('click', async () => {
    if(!confirm('Delete this message?')) return;
    try{
      await db.collection('messages_group').doc(btn.dataset.delete).delete();
    }catch(err){
      console.error(err);
      showToast(err.message, true);
    }
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

/* Images are resized + compressed client-side, then stored as a base64
   string directly in the Firestore message doc — no Firebase Storage
   (and no Blaze billing plan / card) needed. Firestore documents cap out
   at 1MB, so we compress well under that. */
const MAX_IMAGE_DIMENSION = 900;
const IMAGE_QUALITY = 0.6;
const MAX_VOICE_SECONDS = 30;

function compressImageToDataUrl(file, maxDim = MAX_IMAGE_DIMENSION, quality = IMAGE_QUALITY){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if(width > height && width > maxDim){
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else if(height > maxDim){
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function approxBytesFromDataUrl(dataUrl){
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round(base64.length * 0.75);
}

$('input-ann-image').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file || !state.currentUser.isAdmin) return;
  try{
    showToast('Compressing photo…');
    const dataUrl = await compressImageToDataUrl(file);
    const size = approxBytesFromDataUrl(dataUrl);
    if(size > 900 * 1024){
      showToast('That photo is still too large after compression — try a smaller one.', true);
      return;
    }
    await postAnnouncement({ type: 'image', imageData: dataUrl, fileSize: size });
    showToast('Photo sent.');
  }catch(err){
    console.error(err);
    showToast('Could not process that photo.', true);
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
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32000 });
      state.recording.recorder = recorder;
      state.recording.chunks = [];
      recorder.ondataavailable = (ev) => state.recording.chunks.push(ev.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearTimeout(state.recording.timeoutId);
        const blob = new Blob(state.recording.chunks, { type: 'audio/webm' });
        try{
          showToast('Uploading voice message…');
          const dataUrl = await blobToDataUrl(blob);
          const size = approxBytesFromDataUrl(dataUrl);
          if(size > 900 * 1024){
            showToast('That recording is too long — keep it under 30 seconds.', true);
            return;
          }
          await postAnnouncement({ type: 'voice', audioData: dataUrl, fileSize: size });
          showToast('Voice message sent.');
        }catch(err){
          console.error(err);
          showToast('Could not process that recording.', true);
        }
      };
      recorder.start();
      state.recording.active = true;
      btn.classList.add('recording');
      btn.textContent = '⏹️';
      // Auto-stop at the cap so a forgotten recording can't blow past Firestore's size limit
      state.recording.timeoutId = setTimeout(() => {
        if(state.recording.active) $('btn-ann-voice').click();
      }, MAX_VOICE_SECONDS * 1000);
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
    imageData: payload.imageData || null,
    audioData: payload.audioData || null,
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
