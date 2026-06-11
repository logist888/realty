const path = require('path');
const express = require('express');
const session = require('express-session');

const { loadUser } = require('./src/auth');
const helpers = require('./src/helpers');
const { buildingSvg } = require('./src/placeholder');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'realty-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 30 * 24 * 3600 * 1000 },
}));
app.use(loadUser);

// Общие данные для всех шаблонов
app.use((req, res, next) => {
  res.locals.h = helpers;
  res.locals.query = req.query;
  res.locals.currentPath = req.path;
  next();
});

// Генерируемые SVG-заглушки фотографий: /img/ph/<offerId>-<n>.svg
app.get('/img/ph/:seed', (req, res) => {
  res.type('image/svg+xml');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(buildingSvg(req.params.seed.replace(/\.svg$/, '')));
});

app.use('/', require('./src/routes/auth'));
app.use('/', require('./src/routes/offers'));
app.use('/', require('./src/routes/cabinet'));

app.use((req, res) => res.status(404).render('404'));

app.listen(PORT, () => {
  console.log(`Реалти запущен: http://localhost:${PORT}`);
});
