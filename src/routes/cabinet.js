const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { requireAuth } = require('../auth');
const { CITIES, RENOVATIONS, PURPOSES, PARKING_TYPES, NON_RESIDENTIAL } = require('../helpers');

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

// parseInt с сохранением нуля (этаж 0 = цоколь); пустые значения -> null
function intOrNull(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = parseInt(value, 10);
  return Number.isInteger(n) ? n : null;
}

// Валидация формы объявления; возвращает {values, errors}
function parseOfferForm(body) {
  const errors = [];
  const v = {
    deal_type: ['sale', 'rent_long', 'rent_daily'].includes(body.deal_type) ? body.deal_type : null,
    offer_type: ['flat', 'room', 'house', 'commercial', 'storage', 'parking'].includes(body.offer_type) ? body.offer_type : null,
    description: (body.description || '').trim(),
    price: parseInt(body.price, 10),
    rooms: parseInt(body.rooms, 10),
    area_total: parseFloat(body.area_total),
    area_living: parseFloat(body.area_living) || null,
    area_kitchen: parseFloat(body.area_kitchen) || null,
    floor: intOrNull(body.floor),
    floors_total: intOrNull(body.floors_total) > 0 ? intOrNull(body.floors_total) : null,
    build_year: parseInt(body.build_year, 10) || null,
    city: (body.city || '').trim(),
    district: (body.district || '').trim(),
    address: (body.address || '').trim(),
    metro: (body.metro || '').trim(),
    metro_minutes: parseInt(body.metro_minutes, 10) || null,
    renovation: RENOVATIONS.includes(body.renovation) ? body.renovation : '',
    balcony: body.balcony ? 1 : 0,
    purpose: PURPOSES.includes(body.purpose) ? body.purpose : '',
    parking_type: PARKING_TYPES.includes(body.parking_type) ? body.parking_type : '',
    ceiling_height: parseFloat(body.ceiling_height) || null,
    security: body.security ? 1 : 0,
    separate_entrance: body.separate_entrance ? 1 : 0,
  };
  if (!v.deal_type) errors.push('Выберите тип сделки');
  if (!v.offer_type) errors.push('Выберите тип недвижимости');
  if (!Number.isFinite(v.price) || v.price <= 0) errors.push('Укажите цену');
  if (!Number.isFinite(v.area_total) || v.area_total <= 0) errors.push('Укажите общую площадь');
  if (!Number.isInteger(v.rooms) || v.rooms < 0) v.rooms = 1;
  if (!v.city) errors.push('Укажите город');
  if (!v.address) errors.push('Укажите адрес');
  if (v.floor !== null && (v.floor < -10 || v.floor > 100)) {
    errors.push('Этаж должен быть в диапазоне от -10 до 100 (0 — цокольный)');
  }
  if (v.floor !== null && v.floor > 0 && v.floors_total && v.floor > v.floors_total) {
    errors.push('Этаж не может быть больше этажности дома');
  }
  if (v.ceiling_height !== null && (v.ceiling_height < 1 || v.ceiling_height > 20)) {
    errors.push('Высота потолков должна быть от 1 до 20 метров');
  }
  // Жилые характеристики не применимы к нежилым объектам
  if (NON_RESIDENTIAL.includes(v.offer_type)) {
    v.rooms = 0;
    v.area_living = null;
    v.area_kitchen = null;
    v.balcony = 0;
  }
  if (v.offer_type !== 'commercial') {
    v.purpose = '';
    v.separate_entrance = 0;
  }
  if (v.offer_type !== 'parking') v.parking_type = '';

  // Координаты из автоподсказки адреса; иначе — случайная точка у центра города
  const lat = parseFloat(body.lat);
  const lng = parseFloat(body.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    v.lat = lat;
    v.lng = lng;
  } else {
    const cityInfo = CITIES[v.city];
    if (cityInfo) {
      v.lat = cityInfo.center[0] + (Math.random() - 0.5) * 0.1;
      v.lng = cityInfo.center[1] + (Math.random() - 0.5) * 0.15;
    } else {
      v.lat = null;
      v.lng = null;
    }
  }
  return { values: v, errors };
}

const OFFER_COLUMNS = ['deal_type', 'offer_type', 'description', 'price', 'rooms',
  'area_total', 'area_living', 'area_kitchen', 'floor', 'floors_total', 'build_year',
  'city', 'district', 'address', 'metro', 'metro_minutes', 'lat', 'lng', 'renovation', 'balcony',
  'purpose', 'parking_type', 'ceiling_height', 'security', 'separate_entrance'];

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
