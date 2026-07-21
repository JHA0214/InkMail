const form = document.getElementById('login-form');
const keyInput = document.getElementById('access-key');
const errorEl = document.getElementById('login-error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keyInput.value })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || '로그인에 실패했습니다.');
    }

    window.location.href = 'index.html';
  } catch (err) {
    errorEl.hidden = false;
    errorEl.textContent = err.message;
    keyInput.value = '';
    keyInput.focus();
  }
});
