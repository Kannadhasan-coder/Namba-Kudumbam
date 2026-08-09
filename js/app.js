// ============================================================================
// Namba Family — app.js
// Handles: view routing, the 3-step login (family gate → member → password),
// realtime chat + presence via Firestore, message deletion, and the admin
// dashboard. Requires js/config.js, js/firebase-config.js and js/hash.js to
// be loaded first (see index.html) since this file uses their globals.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, deleteDoc, setDoc, updateDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch, Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------
let db, auth, firebaseReady = false;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  firebaseReady = !String(firebaseConfig.apiKey).includes("PASTE_YOUR");
} catch (e) {
  console.error("Firebase failed to initialize — check js/firebase-config.js", e);
}

const MESSAGES_COL = "messages";
const PRESENCE_COL = "presence";
const ONLINE_WINDOW_MS = 20000;   // lastSeen fresher than this = "online"
const HEARTBEAT_MS = 10000;

// ---------------------------------------------------------------------------
// Small DOM + view helpers
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

function showView(id) {
  $all(".view").forEach((v) => v.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let currentMember = null;     // { id, name, role, avatar }
let presenceCache = {};       // memberId -> { online, lastSeen, name, role, avatar }
let unsubMessages = null;
let unsubPresence = null;
let heartbeatInterval = null;
let onlineTickInterval = null;

// ---------------------------------------------------------------------------
// FAMILY GATE
// ---------------------------------------------------------------------------
$("#gate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const codeEl = $("#gate-code");
  const passEl = $("#gate-password");
  const errEl = $("#gate-error");
  const btn = $("#gate-submit");
  errEl.textContent = "";

  const code = codeEl.value.trim();
  const pass = passEl.value;
  if (!code || !pass) {
    errEl.textContent = "Enter both the family code and password.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Checking…";
  const [codeHash, passHash] = await Promise.all([sha256Hex(code), sha256Hex(pass)]);
  btn.disabled = false;
  btn.textContent = "Come Home →";

  if (codeHash === FAMILY_GATE.codeHash && passHash === FAMILY_GATE.passwordHash) {
    sessionStorage.setItem("nf_gate_ok", "1");
    renderMemberGrid();
    showView("#view-select");
  } else {
    errEl.textContent = "That code or password doesn't match. Try again.";
    passEl.value = "";
  }
});

$("#open-admin").addEventListener("click", () => {
  location.hash = "admin";
  showView("#view-admin-login");
});

// ---------------------------------------------------------------------------
// MEMBER SELECT + PER-MEMBER LOGIN
// ---------------------------------------------------------------------------
function renderMemberGrid() {
  const grid = $("#member-grid");
  grid.innerHTML = "";
  MEMBERS.forEach((m, i) => {
    const card = document.createElement("div");
    card.className = "member-card";
    card.style.animationDelay = `${i * 60}ms`;
    card.innerHTML = `
      <div class="member-photo"><img src="${m.avatar}" alt="${m.name}" /></div>
      <div class="member-name">${m.name}</div>
      <div class="member-role">${m.role}</div>
    `;
    card.addEventListener("click", () => openMemberPasswordField(card, m));
    grid.appendChild(card);
  });
}

function openMemberPasswordField(card, member) {
  $all(".member-card").forEach((c) => { c.classList.remove("active"); const r = c.querySelector(".member-password-row"); if (r) r.remove(); });
  card.classList.add("active");

  const row = document.createElement("div");
  row.className = "member-password-row";
  row.innerHTML = `
    <input type="password" placeholder="${member.name}'s password" autocomplete="off" />
    <button class="btn btn-primary">Log in as ${member.name}</button>
    <p class="form-error"></p>
  `;
  card.appendChild(row);

  const input = row.querySelector("input");
  const btn = row.querySelector("button");
  const err = row.querySelector(".form-error");
  input.focus();

  async function attempt() {
    const val = input.value;
    if (!val) { err.textContent = "Enter your password."; return; }
    btn.disabled = true;
    const hash = await sha256Hex(val);
    btn.disabled = false;
    if (hash === member.passwordHash) {
      loginAsMember(member);
    } else {
      err.textContent = "Wrong password.";
      input.value = "";
    }
  }

  btn.addEventListener("click", attempt);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") attempt(); });
}

async function loginAsMember(member) {
  currentMember = member;
  sessionStorage.setItem("nf_member_id", member.id);

  if (firebaseReady) {
    try { await signInAnonymously(auth); } catch (e) { console.error("Anonymous sign-in failed", e); }
  }

  enterChat();
}

// ---------------------------------------------------------------------------
// CHAT
// ---------------------------------------------------------------------------
function enterChat() {
  showView("#view-chat");
  renderSidebarSkeleton();
  startPresence();
  startMessagesListener();

  if (!firebaseReady) {
    toast("⚠ Add your Firebase config in js/firebase-config.js to enable live chat.");
  }
}

function renderSidebarSkeleton() {
  const list = $("#member-list");
  list.innerHTML = "";
  MEMBERS.forEach((m) => {
    const row = document.createElement("div");
    row.className = "member-list-item" + (m.id === currentMember.id ? " me" : "");
    row.id = `presence-${m.id}`;
    row.innerHTML = `
      <div class="mini-avatar">
        <img src="${m.avatar}" alt="${m.name}" />
        <span class="status-dot" id="dot-${m.id}"></span>
      </div>
      <div class="who">
        <span class="n">${m.name}${m.id === currentMember.id ? " (you)" : ""}</span>
        <span class="r">${m.role}</span>
      </div>
    `;
    list.appendChild(row);
  });
  updateOnlineCount();
}

function updateOnlineCount() {
  const now = Date.now();
  let count = 0;
  MEMBERS.forEach((m) => {
    const p = presenceCache[m.id];
    const isOnline = !!(p && p.lastSeenMs && (now - p.lastSeenMs) < ONLINE_WINDOW_MS);
    const dot = document.getElementById(`dot-${m.id}`);
    if (dot) dot.classList.toggle("online", isOnline);
    if (isOnline) count++;
  });
  const el = $("#online-count");
  if (el) el.textContent = `${count} online`;
}

function startPresence() {
  if (!firebaseReady) return;

  const myRef = doc(db, PRESENCE_COL, currentMember.id);
  const beat = () => setDoc(myRef, {
    name: currentMember.name,
    role: currentMember.role,
    online: true,
    lastSeen: serverTimestamp()
  }, { merge: true }).catch((e) => console.error("presence write failed", e));

  beat();
  heartbeatInterval = setInterval(beat, HEARTBEAT_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") beat();
  });

  window.addEventListener("pagehide", () => {
    updateDoc(myRef, { online: false }).catch(() => {});
  });

  unsubPresence = onSnapshot(collection(db, PRESENCE_COL), (snap) => {
    snap.forEach((d) => {
      const data = d.data();
      const lastSeenMs = data.lastSeen && data.lastSeen.toMillis ? data.lastSeen.toMillis() : Date.now();
      presenceCache[d.id] = { ...data, lastSeenMs };
    });
    updateOnlineCount();
  });

  onlineTickInterval = setInterval(updateOnlineCount, 5000);
}

function stopPresence() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (onlineTickInterval) clearInterval(onlineTickInterval);
  if (unsubPresence) unsubPresence();
  if (firebaseReady && currentMember) {
    updateDoc(doc(db, PRESENCE_COL, currentMember.id), { online: false }).catch(() => {});
  }
}

// emoji-only detection
const EMOJI_ONLY_RE = /^(\p{Extended_Pictographic}|\u200d|\ufe0f|\s)+$/u;

function startMessagesListener() {
  if (!firebaseReady) return;
  const q = query(collection(db, MESSAGES_COL), orderBy("createdAt", "asc"));
  unsubMessages = onSnapshot(q, (snap) => {
    const box = $("#messages");
    box.innerHTML = "";
    snap.forEach((d) => renderMessage(d.id, d.data()));
    box.scrollTop = box.scrollHeight + 999;
  });
}

function renderMessage(id, data) {
  const box = $("#messages");
  const mine = data.memberId === currentMember.id;
  const member = MEMBERS.find((m) => m.id === data.memberId);
  const time = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : new Date();
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const row = document.createElement("div");
  row.className = "msg-row" + (mine ? " mine" : "");
  row.innerHTML = `
    <div class="mini-avatar"><img src="${member ? member.avatar : ""}" alt="${data.name}" /></div>
    <div class="msg-body">
      <div class="msg-meta"><span>${mine ? "You" : data.name}</span><span>·</span><span>${timeStr}</span></div>
      <div class="bubble ${data.isEmoji ? "emoji-only" : ""}"></div>
      ${mine ? `<button class="msg-delete" data-id="${id}">Delete</button>` : ""}
    </div>
  `;
  row.querySelector(".bubble").textContent = data.text; // textContent → safe from HTML injection
  box.appendChild(row);

  if (mine) {
    row.querySelector(".msg-delete").addEventListener("click", async () => {
      try { await deleteDoc(doc(db, MESSAGES_COL, id)); }
      catch (e) { toast("Couldn't delete — try again."); }
    });
  }
}

async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (!firebaseReady) { toast("Chat isn't connected yet — add your Firebase config."); return; }

  const isEmoji = EMOJI_ONLY_RE.test(trimmed) && trimmed.length <= 16;

  try {
    await addDoc(collection(db, MESSAGES_COL), {
      memberId: currentMember.id,
      name: currentMember.name,
      role: currentMember.role,
      text: trimmed,
      isEmoji,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error(e);
    toast("Message didn't send — check your connection.");
  }
}

$("#send-btn").addEventListener("click", () => {
  const input = $("#msg-input");
  sendMessage(input.value);
  input.value = "";
  input.focus();
});
$("#msg-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("#send-btn").click();
  }
});

// emoji panel
const emojiPanel = $("#emoji-panel");
EMOJI_SET.forEach((em) => {
  const b = document.createElement("button");
  b.textContent = em;
  b.addEventListener("click", () => {
    $("#msg-input").value += em;
    $("#msg-input").focus();
  });
  emojiPanel.appendChild(b);
});
$("#emoji-toggle").addEventListener("click", () => emojiPanel.classList.toggle("hidden"));
document.addEventListener("click", (e) => {
  if (!emojiPanel.contains(e.target) && e.target.id !== "emoji-toggle") emojiPanel.classList.add("hidden");
});

$("#sidebar-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

$("#logout-btn").addEventListener("click", () => {
  stopPresence();
  if (unsubMessages) unsubMessages();
  sessionStorage.removeItem("nf_member_id");
  currentMember = null;
  renderMemberGrid();
  showView("#view-select");
});

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------
$("#admin-back").addEventListener("click", () => { location.hash = ""; showView("#view-gate"); });
$("#admin-exit").addEventListener("click", () => { location.hash = ""; showView("#view-gate"); });

$("#admin-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const codeEl = $("#admin-code");
  const passEl = $("#admin-password");
  const errEl = $("#admin-login-error");
  errEl.textContent = "";

  const [codeHash, passHash] = await Promise.all([sha256Hex(codeEl.value.trim()), sha256Hex(passEl.value)]);
  if (codeHash === ADMIN.codeHash && passHash === ADMIN.passwordHash) {
    if (firebaseReady) { try { await signInAnonymously(auth); } catch (e) {} }
    showView("#view-admin");
    loadAdminDashboard();
  } else {
    errEl.textContent = "That admin code or password doesn't match.";
    passEl.value = "";
  }
});

async function loadAdminDashboard() {
  if (!firebaseReady) {
    toast("Add your Firebase config to see live admin data.");
    return;
  }
  try {
    const snap = await getDocs(collection(db, MESSAGES_COL));
    let total = 0, bytes = 0;
    const perMember = {};
    MEMBERS.forEach((m) => (perMember[m.id] = 0));

    snap.forEach((d) => {
      total++;
      const data = d.data();
      bytes += JSON.stringify(data).length;
      if (perMember[data.memberId] !== undefined) perMember[data.memberId]++;
    });

    $("#stat-total").textContent = total;
    $("#stat-storage").textContent = formatBytes(bytes);

    const presenceSnap = await getDocs(collection(db, PRESENCE_COL));
    const now = Date.now();
    let online = 0;
    presenceSnap.forEach((d) => {
      const data = d.data();
      const ms = data.lastSeen && data.lastSeen.toMillis ? data.lastSeen.toMillis() : 0;
      if (now - ms < ONLINE_WINDOW_MS) online++;
    });
    $("#stat-online").textContent = online;

    const listEl = $("#per-member-list");
    listEl.innerHTML = "";
    MEMBERS.forEach((m) => {
      const row = document.createElement("div");
      row.className = "per-member-row";
      row.innerHTML = `<span class="n">${m.name} · ${m.role}</span><span class="c">${perMember[m.id]} msgs</span>`;
      listEl.appendChild(row);
    });
  } catch (e) {
    console.error(e);
    toast("Couldn't load admin data — check Firestore rules/config.");
  }
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

$("#delete-all-btn").addEventListener("click", async () => {
  if (!firebaseReady) { toast("Connect Firebase first."); return; }
  if (!confirm("Delete ALL family chat messages? This can't be undone.")) return;

  try {
    const snap = await getDocs(collection(db, MESSAGES_COL));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    toast("All chat messages deleted.");
    loadAdminDashboard();
  } catch (e) {
    console.error(e);
    toast("Delete failed — check Firestore rules.");
  }
});

// ---------------------------------------------------------------------------
// BOOT — restore session, or route to #admin if requested
// ---------------------------------------------------------------------------
(function boot() {
  if (location.hash === "#admin") {
    showView("#view-admin-login");
    return;
  }

  const gateOk = sessionStorage.getItem("nf_gate_ok") === "1";
  const memberId = sessionStorage.getItem("nf_member_id");

  if (gateOk && memberId) {
    const member = MEMBERS.find((m) => m.id === memberId);
    if (member) {
      currentMember = member;
      if (firebaseReady) signInAnonymously(auth).catch(() => {});
      enterChat();
      return;
    }
  }

  if (gateOk) {
    renderMemberGrid();
    showView("#view-select");
    return;
  }

  showView("#view-gate");
})();
