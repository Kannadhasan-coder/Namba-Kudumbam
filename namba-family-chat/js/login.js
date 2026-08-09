// Avatar login screen — click your face, then enter your password.
// The actual password check happens server-side (api/verify-user.js);
// this file only knows names/roles/photos, never passwords.

if (sessionStorage.getItem('nf_gatePassed') !== 'true') {
  window.location.href = 'index.html';
}

const MEMBERS = [
  { id: 'photo1', name: 'Akilan',   role: 'Dady',      photo: 'assets/photo1.png' },
  { id: 'photo2', name: 'Rithish',  role: 'Naina',     photo: 'assets/photo2.png' },
  { id: 'photo3', name: 'Khavin',   role: 'Son',       photo: 'assets/photo3.png' },
  { id: 'photo4', name: 'Muguthan', role: 'Marumagal', photo: 'assets/photo4.png' },
  { id: 'photo5', name: 'Kanna',    role: 'Thatha',    photo: 'assets/photo5.png' },
  { id: 'photo6', name: 'Vishwa',   role: 'Son2',      photo: 'assets/photo6.png' },
];

const grid = document.getElementById('memberGrid');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalPhoto = document.getElementById('modalPhoto');
const modalName = document.getElementById('modalName');
const modalRole = document.getElementById('modalRole');
const memberPassword = document.getElementById('memberPassword');
const memberError = document.getElementById('memberError');
const memberLoginBtn = document.getElementById('memberLoginBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');

let activeMember = null;

MEMBERS.forEach((m) => {
  const card = document.createElement('button');
  card.className = 'member-card';
  card.type = 'button';
  card.innerHTML = `
    <div class="member-photo"><img src="${m.photo}" alt="${m.name}"></div>
    <div class="member-name">${m.name}</div>
    <div class="member-role">${m.role}</div>
  `;
  card.addEventListener('click', () => openModal(m));
  grid.appendChild(card);
});

function openModal(member) {
  activeMember = member;
  modalPhoto.querySelector('img').src = member.photo;
  modalName.textContent = member.name;
  modalRole.textContent = member.role;
  memberPassword.value = '';
  memberError.classList.remove('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => memberPassword.focus(), 150);
}

function closeModal() {
  modalBackdrop.classList.remove('show');
  activeMember = null;
}

modalCloseBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});

async function attemptLogin() {
  if (!activeMember) return;
  memberError.classList.remove('show');
  memberLoginBtn.disabled = true;
  memberLoginBtn.textContent = 'Checking…';

  try {
    const res = await fetch('/api/verify-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeMember.id, password: memberPassword.value })
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem('nf_currentUser', JSON.stringify(data.user));
      window.location.href = 'chat.html';
    } else {
      memberError.classList.add('show');
    }
  } catch (err) {
    memberError.textContent = 'Connection problem. Try again.';
    memberError.classList.add('show');
  } finally {
    memberLoginBtn.disabled = false;
    memberLoginBtn.textContent = 'Login';
  }
}

memberLoginBtn.addEventListener('click', attemptLogin);
memberPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') attemptLogin();
});
