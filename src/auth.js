const crypto = require('crypto');
const db = require('./db');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), candidate);
}

// Подкладывает текущего пользователя в req.user и res.locals для шаблонов
function loadUser(req, res, next) {
  req.user = null;
  if (req.session.userId) {
    req.user = db.prepare('SELECT id, email, name, phone, is_agent FROM users WHERE id = ?')
      .get(req.session.userId) || null;
  }
  res.locals.user = req.user;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

module.exports = { hashPassword, verifyPassword, loadUser, requireAuth };
