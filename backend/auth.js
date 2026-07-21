const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_NAME = 'inkmail_session';

function getSessionToken() {
  return crypto.createHmac('sha256', SESSION_SECRET).update('authenticated').digest('hex');
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkAccessKey(key) {
  if (!process.env.ACCESS_KEY) return false;
  return timingSafeStringEqual(key, process.env.ACCESS_KEY);
}

function isAuthenticated(req) {
  return timingSafeStringEqual(req.cookies?.[COOKIE_NAME], getSessionToken());
}

function requireAuthPage(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.redirect('/login.html');
}

function requireAuthApi(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: '인증이 필요합니다.' });
}

module.exports = { COOKIE_NAME, getSessionToken, checkAccessKey, requireAuthPage, requireAuthApi };
