const express = require('express');
const db = require('../db');
const { searchOffers, getOffer, similarOffers } = require('../queries');

const router = express.Router();

router.get('/', (req, res) => {
  const stats = db.prepare(`
    SELECT
      SUM(CASE WHEN deal_type = 'sale' THEN 1 ELSE 0 END) AS sale,
      SUM(CASE WHEN deal_type != 'sale' THEN 1 ELSE 0 END) AS rent,
      COUNT(*) AS total
    FROM offers WHERE is_active = 1
  `).get();
  const fresh = db.prepare(`
    SELECT o.*, (SELECT url FROM photos p WHERE p.offer_id = o.id ORDER BY position LIMIT 1) AS photo
    FROM offers o WHERE o.is_active = 1 ORDER BY o.created_at DESC LIMIT 8
  `).all();
  res.render('home', { stats, fresh });
});

router.get('/search', (req, res) => {
  const result = searchOffers(req.query, req.user && req.user.id);
  res.render('search', { ...result });
});

router.get('/offer/:id', (req, res) => {
  const offer = getOffer(Number(req.params.id), req.user && req.user.id);
  if (!offer || (!offer.is_active && (!req.user || req.user.id !== offer.user_id))) {
    return res.status(404).render('404');
  }
  db.prepare('UPDATE offers SET views = views + 1 WHERE id = ?').run(offer.id);
  res.render('offer', { offer, similar: similarOffers(offer) });
});

// API: телефон продавца (отдаём по явному клику, как на Циан)
router.get('/api/offers/:id/phone', (req, res) => {
  const row = db.prepare(`
    SELECT u.phone, u.name FROM offers o JOIN users u ON u.id = o.user_id WHERE o.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

// API: избранное
router.post('/api/favorites/:id', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'auth required' });
  const offerId = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM offers WHERE id = ?').get(offerId)) {
    return res.status(404).json({ error: 'not found' });
  }
  const existing = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND offer_id = ?')
    .get(req.user.id, offerId);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND offer_id = ?').run(req.user.id, offerId);
    return res.json({ favorite: false });
  }
  db.prepare('INSERT INTO favorites (user_id, offer_id) VALUES (?, ?)').run(req.user.id, offerId);
  res.json({ favorite: true });
});

module.exports = router;
