const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const sanitizeHtml = require('sanitize-html');

const SAFE_LENGTH = /^-?\d+(\.\d+)?(px|em|rem|%)$/;
const SAFE_COLOR = [
  /^#[0-9a-fA-F]{3,8}$/,
  /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,
  /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/,
  /^[a-zA-Z]+$/
];

// 메일 HTML을 렌더링 전에 정제한다:
// - <a target="_blank">에 rel=noopener를 강제해 reverse tabnabbing을 막는다.
// - <a href>는 http/https만 허용해 data: URI를 이용한 피싱 링크를 막는다.
// - 원격 이미지(http/https)는 즉시 로드하지 않고 data-src로 옮겨, 트래킹 픽셀을 막는다
//   (data: 인라인 이미지는 네트워크 요청이 없으므로 그대로 둔다).
// - style 태그/속성은 화이트리스트 속성-값만 허용해 background:url()을 통한
//   이미지 트래킹 우회나 CSS 기반 데이터 유출을 막는다.
function sanitizeMailHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'span', 'div', 'font', 'center', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ]),
    allowedAttributes: {
      '*': ['style', 'align', 'width', 'height', 'colspan', 'rowspan'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'data-src']
    },
    allowedSchemesByTag: {
      a: ['http', 'https'],
      img: ['http', 'https', 'data']
    },
    allowedStyles: {
      '*': {
        color: SAFE_COLOR,
        'background-color': SAFE_COLOR,
        'text-align': [/^(left|right|center|justify)$/],
        'font-weight': [/^(bold|normal|[1-9]00)$/],
        'font-style': [/^(italic|normal)$/],
        'font-size': [SAFE_LENGTH],
        'text-decoration': [/^(underline|none|line-through)$/],
        margin: [SAFE_LENGTH],
        padding: [SAFE_LENGTH],
        'border-radius': [SAFE_LENGTH],
        width: [SAFE_LENGTH],
        height: [SAFE_LENGTH]
      }
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' }
      }),
      img: (tagName, attribs) => {
        if (attribs.src && /^https?:/i.test(attribs.src)) {
          const { src, ...rest } = attribs;
          return { tagName, attribs: { ...rest, 'data-src': src } };
        }
        return { tagName, attribs };
      }
    },
    allowVulnerableTags: false
  });
}

function getClient() {
  return new ImapFlow({
    host: process.env.KAKAO_IMAP_HOST || 'imap.kakao.com',
    port: Number(process.env.KAKAO_IMAP_PORT) || 993,
    secure: true,
    auth: {
      user: process.env.KAKAO_EMAIL,
      pass: process.env.KAKAO_APP_PASSWORD
    },
    logger: false
  });
}

// 최신 메일이 앞에 오도록 페이지 단위로 목록을 가져온다.
async function listMails(page = 1, limit = 20) {
  const client = getClient();
  await client.connect();

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const total = client.mailbox.exists;
      if (total === 0) return { total: 0, page, limit, mails: [] };

      const high = Math.max(1, total - (page - 1) * limit);
      const low = Math.max(1, high - limit + 1);
      if (high < 1) return { total, page, limit, mails: [] };

      const mails = [];
      for await (const msg of client.fetch(`${low}:${high}`, {
        envelope: true,
        flags: true,
        uid: true
      })) {
        mails.push({
          uid: msg.uid,
          subject: msg.envelope.subject || '(제목 없음)',
          from: msg.envelope.from?.[0]?.name || msg.envelope.from?.[0]?.address || '(발신자 없음)',
          date: msg.envelope.date,
          seen: msg.flags.has('\\Seen')
        });
      }
      mails.reverse(); // 최신순 정렬

      return { total, page, limit, mails };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// 단일 메일 본문(uid 기준)을 가져와 파싱한다.
async function getMail(uid) {
  const client = getClient();
  await client.connect();

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const message = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
      if (!message) {
        const err = new Error('메일을 찾을 수 없습니다.');
        err.status = 404;
        throw err;
      }

      const parsed = await simpleParser(message.source);
      await client.messageFlagsAdd({ uid: String(uid) }, ['\\Seen'], { uid: true });

      const safeHtml = parsed.html ? sanitizeMailHtml(parsed.html) : null;

      return {
        uid,
        subject: parsed.subject || '(제목 없음)',
        from: parsed.from?.text || '(발신자 없음)',
        date: parsed.date,
        html: safeHtml,
        text: parsed.text || ''
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

module.exports = { listMails, getMail };
