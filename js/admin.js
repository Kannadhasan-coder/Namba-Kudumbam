// Namba Family — admin dashboard logic

const MEMBERS = [
  { id: 'photo1', name: 'Akilan',   photo: 'assets/photo1.png' },
  { id: 'photo2', name: 'Rithish',  photo: 'assets/photo2.png' },
  { id: 'photo3', name: 'Khavin',   photo: 'assets/photo3.png' },
  { id: 'photo4', name: 'Muguthan', photo: 'assets/photo4.png' },
  { id: 'photo5', name: 'Kanna',    photo: 'assets/photo5.png' },
  { id: 'photo6', name: 'Vishwa',   photo: 'assets/photo6.png' },
];

// Firebase Realtime Database free (Spark plan) storage ceiling, used only
// to render a rough "how full is it" estimate — not an exact figure.
const DB_FREE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB

const adminLoginScreen = document.getElementById('adminLoginScreen');
const adminDash = document.getElementById('adminDash');
const adminForm = document.getElementById('adminForm');
const adminError = document.getElementById('adminError');
const adminBtn = document.getElementById('adminBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const deleteAllBtn = document.getElementById('deleteAllBtn');
const toastEl = document.getElementById('toast');

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function enterDashboard() {
  sessionStorage.setItem('nf_adminAuthed', 'true');
  adminLoginScreen.style.display = 'none';
  adminDash.style.display = 'block';
  loadAnalytics();
}

if (sessionStorage.getItem('nf_adminAuthed') === 'true') {
  enterDashboard();
}

adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  adminError.classList.remove('show');
  adminBtn.disabled = true;
  adminBtn.textContent = 'Checking…';

  const code = document.getElementById('adminCode').value.trim();
  const password = document.getElementById('adminPassword').value;

  try {
    const res = await fetch('/api/verify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, password })
    });
    const data = await res.json();

    if (data.success) {
      enterDashboard();
    } else {
      adminError.classList.add('show');
    }
  } catch (err) {
    adminError.textContent = 'Connection problem. Try again.';
    adminError.classList.add('show');
  } finally {
    adminBtn.disabled = false;
    adminBtn.textContent = 'Login →';
  }
});

adminLogoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('nf_adminAuthed');
  adminDash.style.display = 'none';
  adminLoginScreen.style.display = 'flex';
});

/* ---------------- Analytics ---------------- */

function loadAnalytics() {
  // Total messages + per-member counts + storage estimate
  db.ref('messages').once('value', (snap) => {
    const data = snap.val() || {};
    const entries = Object.values(data);
    const total = entries.length;

    document.getElementById('statTotalMsgs').textContent = total;

    const counts = {};
    let totalBytes = 0;
    entries.forEach((m) => {
      counts[m.senderId] = (counts[m.senderId] || 0) + 1;
      // rough byte estimate: message text + ~120 bytes of json overhead/fields
      totalBytes += new Blob([m.text || '']).size + 120;
    });

    const maxCount = Math.max(1, ...Object.values(counts), 1);
    const barsWrap = document.getElementById('memberBars');
    barsWrap.innerHTML = '';
    MEMBERS.forEach((m) => {
      const c = counts[m.id] || 0;
      const pct = Math.round((c / maxCount) * 100);
      const row = document.createElement('div');
      row.className = 'member-bar-row';
      row.innerHTML = `
        <img src="${m.photo}" alt="">
        <span class="bar-name">${m.name}</span>
        <div class="member-bar-track"><div class="member-bar-fill" style="width:${pct}%;"></div></div>
        <span class="member-bar-count">${c}</span>
      `;
      barsWrap.appendChild(row);
    });

    const usedPct = Math.min(100, (totalBytes / DB_FREE_LIMIT_BYTES) * 100);
    document.getElementById('storageFill').style.width = usedPct.toFixed(4) + '%';

    const avgBytes = total > 0 ? totalBytes / total : 150;
    const remainingBytes = Math.max(0, DB_FREE_LIMIT_BYTES - totalBytes);
    const estRemainingMsgs = Math.floor(remainingBytes / avgBytes);

    document.getElementById('storageNote').textContent =
      `~${formatBytes(totalBytes)} used out of 1 GB (free plan estimate) · ~${estRemainingMsgs.toLocaleString('en-IN')} more messages ah anuppalam (rough estimate)`;
  });

  db.ref('presence').once('value', (snap) => {
    const data = snap.val() || {};
    const onlineCount = Object.values(data).filter((v) => v.online).length;
    document.getElementById('statOnline').textContent = onlineCount;
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/* ---------------- Delete all chat ---------------- */

deleteAllBtn.addEventListener('click', () => {
  const sure = confirm('Ella chat messages um permanent ah delete pandralama? Idha undo panna mudiyathu.');
  if (!sure) return;

  deleteAllBtn.disabled = true;
  deleteAllBtn.textContent = 'Deleting…';

  db.ref('messages').remove()
    .then(() => {
      showToast('Ella chats um delete aachu');
      loadAnalytics();
    })
    .finally(() => {
      deleteAllBtn.disabled = false;
      deleteAllBtn.textContent = 'Delete All Chat';
    });
});
