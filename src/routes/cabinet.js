const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { requireAuth } = require('../auth');
const { CITIES, RENOVATIONS } = require('../helpers');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype));
  },
});

// Валидация формы объявления; возвращает {values, errors}
function parseOfferForm(body) {
  const errors = [];
  const v = {
    deal_type: ['sale', 'rent_long', 'rent_daily'].includes(body.deal_type) ? body.deal_type : null,
    offer_type: ['flat', 'room', 'house', 'commercial'].includes(body.offer_type) ? body.offer_type : null,
    description: (body.description || '').trim(),
    price: parseInt(body.price, 10),
    rooms: parseInt(body.rooms, 10),
    area_total: parseFloat(body.area_total),
    area_living: parseFloat(body.area_living) || null,
    area_kitchen: parseFloat(body.area_kitchen) || null,
    floor: parseInt(body.floor, 10) || null,
    floors_total: parseInt(body.floors_total, 10) || null,
    build_year: parseInt(body.build_year, 10) || null,
    city: (body.city || '').trim(),
    district: (body.district || '').trim(),
    address: (body.address || '').trim(),
    metro: (body.metro || '').trim(),
    metro_minutes: parseInt(body.metro_minutes, 10) || null,
    renovation: RENOVATIONS.includes(body.renovation) ? body.renovation : '',
    balcony: body.balcony ? 1 : 0,
  };
  if (!v.deal_type) errors.push('Выберите тип сделки');
  if (!v.offer_type) errors.push('Выберите тип недвижимости');
  if (!Number.isFinite(v.price) || v.price <= 0) errors.push('Укажите цену');
  if (!Number.isFinite(v.area_total) || v.area_total <= 0) errors.push('Укажите общую площадь');
  if (!Number.isInteger(v.rooms) || v.rooms < 0) v.rooms = 1;
  if (!v.city) errors.push('Укажите город');
  if (!v.address) errors.push('Укажите адрес');
  if (v.floor && v.floors_total && v.floor > v.floors_total) errors.push('Этаж не может быть больше этажности дома');

  const cityInfo = CITIES[v.city];
  if (cityInfo) {
    v.lat = cityInfo.center[0] + (Math.random() - 0.5) * 0.1;
    v.lng = cityInfo.center[1] + (Math.random() - 0.5) * 0.15;
  } else {
    v.lat = null;
    v.lng = null;
  }
  return { values: v, errors };
}

const OFFER_COLUMNS = ['deal_type', 'offer_type', 'description', 'price', 'rooms',
  'area_total', 'area_living', 'area_kitchen', 'floor', 'floors_total', 'build_year',
  'city', 'district', 'address', 'metro', 'metro_minutes', 'lat', 'lng', 'renovation', 'balcony'];

router.get('/offers/new', requireAuth, (req, res) => {
  res.render('offer-form', { offer: null, errors: [], values: {} });
});

router.post('/offers/new', requireAuth, upload.array('photos', 10), (req, res) => {
  const { values, errors } = parseOfferForm(req.body);
  if (errors.length) {
    return res.status(400).render('offer-form', { offer: null, errors, values });
  }
  const cols = OFFER_COLUMNS.join(', ');
  const placeholders = OFFER_COLUMNS.map(() => '?').join(', ');
  const result = db.prepare(`INSERT INTO offers (user_id, title, ${cols}) VALUES (?, '', ${placeholders})`)
    .run(req.user.id, ...OFFER_COLUMNS.map(c => values[c]));
  const offerId = result.lastInsertRowid;

  const insertPhoto = db.prepare('INSERT INTO photos (offer_id, url, position) VALUES (?, ?, ?)');
  if (req.files && req.files.length) {
    req.files.forEach((f, i) => insertPhoto.run(offerId, `/uploads/${f.filename}`, i));
  } else {
    for (let i = 0; i < 3; i++) insertPhoto.run(offerId, `/img/ph/${offerId}-${i}.svg`, i);
  }
  res.redirect(`/offer/${offerId}`);
});

function ownOffer(req, res) {
  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(Number(req.params.id));
  if (!offer || offer.user_id !== req.user.id) {
    res.status(404).render('404');
    return null;
  }
  return offer;
}

router.get('/offers/:id/edit', requireAuth, (req, res) => {
  const offer = ownOffer(req, res);
  if (!offer) return;
  res.render('offer-form', { offer, errors: [], values: offer });
});

router.post('/offers/:id/edit', requireAuth, upload.array('photos', 10), (req, res) => {
  const offer = ownOffer(req, res);
  if (!offer) return;
  const { values, errors } = parseOfferForm(req.body);
  if (errors.length) {
    return res.status(400).render('offer-form', { offer, errors, values });
  }
  const setClause = OFFER_COLUMNS.map(c => `${c} = ?`).join(', ');
  db.prepare(`UPDATE offers SET ${setClause} WHERE id = ?`)
    .run(...OFFER_COLUMNS.map(c => values[c]), offer.id);
  if (req.files && req.files.length) {
    const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM photos WHERE offer_id = ?').get(offer.id).m;
    const insertPhoto = db.prepare('INSERT INTO photos (offer_id, url, position) VALUES (?, ?, ?)');
    req.files.forEach((f, i) => insertPhoto.run(offer.id, `/uploads/${f.filename}`, maxPos + 1 + i));
  }
  res.redirect(`/offer/${offer.id}`);
});

router.post('/offers/:id/toggle', requireAuth, (req, res) => {
  const offer = ownOffer(req, res);
  if (!offer) return;
  db.prepare('UPDATE offers SET is_active = 1 - is_active WHERE id = ?').run(offer.id);
  res.redirect('/my');
});

router.post('/offers/:id/delete', requireAuth, (req, res) => {
  const offer = ownOffer(req, res);
  if (!offer) return;
  db.prepare('DELETE FROM offers WHERE id = ?').run(offer.id);
  res.redirect('/my');
});

router.get('/my', requireAuth, (req, res) => {
  const offers = db.prepare(`
    SELECT o.*, (SELECT url FROM photos p WHERE p.offer_id = o.id ORDER BY position LIMIT 1) AS photo
    FROM offers o WHERE o.user_id = ? ORDER BY o.created_at DESC
  `).all(req.user.id);
  res.render('my-offers', { offers });
});

router.get('/favorites', requireAuth, (req, res) => {
  const offers = db.prepare(`
    SELECT o.*, 1 AS is_favorite,
      (SELECT url FROM photos p WHERE p.offer_id = o.id ORDER BY position LIMIT 1) AS photo,
      (SELECT COUNT(*) FROM photos p WHERE p.offer_id = o.id) AS photo_count
    FROM favorites f JOIN offers o ON o.id = f.offer_id
    WHERE f.user_id = ? ORDER BY f.created_at DESC
  `).all(req.user.id);
  res.render('favorites', { offers });
});

module.exports = router;
