require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { listMails, getMail } = require('./mailService');
const { COOKIE_NAME, getSessionToken, checkAccessKey, requireAuthPage, requireAuthApi } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  frameguard: { action: 'deny' }
}));
app.use(cookieParser());
app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.' }
});

app.post('/api/login', loginLimiter, (req, res) => {
  const { key } = req.body || {};
  if (!checkAccessKey(key)) {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }
  res.cookie(COOKIE_NAME, getSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

// 메일 목록/본문 화면은 로그인 후에만 볼 수 있도록 정적 서빙보다 먼저 가드를 건다.
app.get(['/', '/index.html'], requireAuthPage, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});
app.get('/reader.html', requireAuthPage, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'reader.html'));
});

// login.html, css/js, manifest, 아이콘 등은 민감한 데이터가 없어 인증 없이 서빙한다.
app.use(express.static(PUBLIC_DIR));

app.get('/api/mails', requireAuthApi, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const result = await listMails(page, limit);
    res.json(result);
  } catch (err) {
    console.error(err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: '메일함을 불러오지 못했습니다.' });
  }
});

app.get('/api/mails/:uid', requireAuthApi, async (req, res) => {
  try {
    const uid = Number(req.params.uid);
    if (!Number.isInteger(uid)) {
      return res.status(400).json({ error: '잘못된 메일 uid입니다.' });
    }
    const mail = await getMail(uid);
    res.json(mail);
  } catch (err) {
    console.error(err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: '메일을 불러오지 못했습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`InkMail server running at http://localhost:${PORT}`);
});
