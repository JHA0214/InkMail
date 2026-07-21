const params = new URLSearchParams(window.location.search);
const uid = params.get('uid');

const subjectEl = document.getElementById('subject');
const pagesEl = document.getElementById('pages');
const indicatorEl = document.getElementById('page-indicator');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const backBtn = document.getElementById('back-btn');
const showImagesBtn = document.getElementById('show-images');

let pageCount = 1;
let pageIndex = 0;
let pageWidth = window.innerWidth;

backBtn.addEventListener('click', () => {
  if (document.referrer) {
    history.back();
  } else {
    window.location.href = 'index.html';
  }
});

function textToHtml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${escaped.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

function recalculatePages() {
  pageWidth = document.querySelector('.reader-viewport').clientWidth;
  pageCount = Math.max(1, Math.round(pagesEl.scrollWidth / pageWidth));
  if (pageIndex >= pageCount) pageIndex = pageCount - 1;
  goToPage(pageIndex);
}

function goToPage(index) {
  pageIndex = Math.min(Math.max(index, 0), pageCount - 1);
  pagesEl.style.transform = `translateX(-${pageIndex * pageWidth}px)`;
  indicatorEl.textContent = `${pageIndex + 1} / ${pageCount}`;
  prevBtn.disabled = pageIndex <= 0;
  nextBtn.disabled = pageIndex >= pageCount - 1;
}

prevBtn.addEventListener('click', () => goToPage(pageIndex - 1));
nextBtn.addEventListener('click', () => goToPage(pageIndex + 1));

document.addEventListener('keydown', (e) => {
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) goToPage(pageIndex + 1);
  if (['ArrowLeft', 'PageUp'].includes(e.key)) goToPage(pageIndex - 1);
});

let touchStartX = null;
document.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
});
document.addEventListener('touchend', (e) => {
  if (touchStartX === null) return;
  const deltaX = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(deltaX) > 40) {
    if (deltaX < 0) goToPage(pageIndex + 1);
    else goToPage(pageIndex - 1);
  }
  touchStartX = null;
});

window.addEventListener('resize', recalculatePages);

// 원격 이미지는 트래킹 픽셀 방지를 위해 서버에서 data-src로 옮겨 보내온다.
// 사용자가 직접 눌러야만 실제로 불러온다.
showImagesBtn.addEventListener('click', () => {
  const lazyImages = Array.from(pagesEl.querySelectorAll('img[data-src]'));
  if (lazyImages.length === 0) return;

  showImagesBtn.disabled = true;
  const loads = lazyImages.map((img) => new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  }));

  Promise.all(loads).then(() => {
    showImagesBtn.hidden = true;
    recalculatePages();
  });
});

async function loadMail() {
  if (!uid) {
    subjectEl.textContent = '잘못된 요청입니다.';
    return;
  }

  try {
    const res = await fetch(`/api/mails/${uid}`);
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!res.ok) throw new Error((await res.json()).error || '메일을 불러오지 못했습니다.');
    const mail = await res.json();

    subjectEl.textContent = mail.subject;
    document.title = mail.subject;
    pagesEl.innerHTML = mail.html || textToHtml(mail.text);

    if (pagesEl.querySelector('img[data-src]')) {
      showImagesBtn.hidden = false;
    }

    // 레이아웃 반영 후 페이지 수 계산
    requestAnimationFrame(() => requestAnimationFrame(recalculatePages));
  } catch (err) {
    subjectEl.textContent = '오류';
    pagesEl.textContent = err.message;
  }
}

loadMail();
