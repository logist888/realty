const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword } = require('../auth');

const router = express.Router();

function safeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/login', { error: null, next: req.query.next || '' });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').trim().toLowerCase());
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).render('auth/login', {
      error: 'Неверный e-mail или пароль', next: req.body.next || '',
    });
  }
  req.session.userId = user.id;
  res.redirect(safeNext(req.body.next));
});

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/register', { error: null, values: {} });
});

router.post('/register', (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const phone = (req.body.phone || '').trim();
  const password = req.body.password || '';

  const fail = (error) => res.status(400).render('auth/register', { error, values: { name, email, phone } });

  if (!name || !email || !password) return fail('Заполните имя, e-mail и пароль');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Некорректный e-mail');
  if (password.length < 6) return fail('Пароль должен быть не короче 6 символов');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return fail('Пользователь с таким e-mail уже существует');

  const result = db.prepare('INSERT INTO users (email, name, phone, password_hash) VALUES (?, ?, ?, ?)')
    .run(email, name, phone, hashPassword(password));
  req.session.userId = result.lastInsertRowid;
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
