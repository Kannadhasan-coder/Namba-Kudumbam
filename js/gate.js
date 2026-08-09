// Family gate — checks code + password against the server-side API
// so the real credentials never sit inside the JS shipped to the browser.

const gateForm = document.getElementById('gateForm');
const gateError = document.getElementById('gateError');
const gateBtn = document.getElementById('gateBtn');

// If already passed the gate in this browser tab, skip straight ahead.
if (sessionStorage.getItem('nf_gatePassed') === 'true') {
  window.location.href = 'login.html';
}

gateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  gateError.classList.remove('show');
  gateBtn.disabled = true;
  gateBtn.textContent = 'Checking…';

  const code = document.getElementById('familyCode').value.trim();
  const password = document.getElementById('familyPassword').value;

  try {
    const res = await fetch('/api/verify-gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, password })
    });
    const data = await res.json();

    if (data.success) {
      sessionStorage.setItem('nf_gatePassed', 'true');
      window.location.href = 'login.html';
    } else {
      gateError.classList.add('show');
    }
  } catch (err) {
    gateError.textContent = 'Connection problem. Try again.';
    gateError.classList.add('show');
  } finally {
    gateBtn.disabled = false;
    gateBtn.textContent = 'Open the door →';
  }
});
