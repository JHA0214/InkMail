const LIMIT = 20;
let currentPage = 1;

const statusEl = document.getElementById('status');
const listEl = document.getElementById('mail-list');
const pagerEl = document.getElementById('pager');
const pageLabelEl = document.getElementById('page-label');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderMails(data) {
  listEl.innerHTML = '';

  if (data.mails.length === 0) {
    statusEl.hidden = false;
    statusEl.textContent = '메일이 없습니다.';
    pagerEl.hidden = true;
    return;
  }

  statusEl.hidden = true;

  for (const mail of data.mails) {
    const li = document.createElement('li');

    const btn = document.createElement('button');
    btn.className = 'mail-item' + (mail.seen ? '' : ' unread');
    btn.addEventListener('click', () => {
      window.location.href = `reader.html?uid=${mail.uid}`;
    });

    const subject = document.createElement('span');
    subject.className = 'mail-subject';
    subject.textContent = mail.subject;

    const meta = document.createElement('div');
    meta.className = 'mail-meta';

    const from = document.createElement('span');
    from.textContent = mail.from;

    const date = document.createElement('span');
    date.textContent = formatDate(mail.date);

    meta.append(from, date);
    btn.append(subject, meta);
    li.appendChild(btn);
    listEl.appendChild(li);
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
  pagerEl.hidden = false;
  pageLabelEl.textContent = `${data.page} / ${totalPages}`;
  prevBtn.disabled = data.page <= 1;
  nextBtn.disabled = data.page >= totalPages;
}

async function loadPage(page) {
  statusEl.hidden = false;
  statusEl.textContent = '불러오는 중...';
  pagerEl.hidden = true;

  try {
    const res = await fetch(`/api/mails?page=${page}&limit=${LIMIT}`);
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!res.ok) throw new Error((await res.json()).error || '메일함을 불러오지 못했습니다.');
    const data = await res.json();
    currentPage = data.page;
    renderMails(data);
  } catch (err) {
    statusEl.hidden = false;
    statusEl.textContent = err.message;
  }
}

prevBtn.addEventListener('click', () => loadPage(currentPage - 1));
nextBtn.addEventListener('click', () => loadPage(currentPage + 1));

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

loadPage(1);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
