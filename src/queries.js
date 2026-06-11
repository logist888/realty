const db = require('./db');

const PER_PAGE = 20;

const SORTS = {
  default: 'o.created_at DESC',
  price_asc: 'o.price ASC',
  price_desc: 'o.price DESC',
  area_desc: 'o.area_total DESC',
  date: 'o.created_at DESC',
};

// Собирает WHERE по параметрам поисковой строки
function buildFilters(q) {
  const where = ['o.is_active = 1'];
  const params = [];

  if (q.deal && ['sale', 'rent_long', 'rent_daily'].includes(q.deal)) {
    where.push('o.deal_type = ?');
    params.push(q.deal);
  }
  if (q.type && ['flat', 'room', 'house', 'commercial'].includes(q.type)) {
    where.push('o.offer_type = ?');
    params.push(q.type);
  }
  if (q.city) {
    where.push('o.city = ?');
    params.push(q.city);
  }
  if (q.district) {
    where.push('o.district = ?');
    params.push(q.district);
  }
  if (q.metro) {
    where.push('o.metro = ?');
    params.push(q.metro);
  }

  let rooms = q.rooms;
  if (rooms !== undefined && rooms !== '') {
    if (!Array.isArray(rooms)) rooms = [rooms];
    const nums = rooms.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 4);
    if (nums.length) {
      const conds = nums.map(n => (n === 4 ? 'o.rooms >= 4' : 'o.rooms = ?'));
      nums.filter(n => n !== 4).forEach(n => params.push(n));
      where.push(`(${conds.join(' OR ')})`);
    }
  }

  const numFilters = [
    ['priceMin', 'o.price >= ?'], ['priceMax', 'o.price <= ?'],
    ['areaMin', 'o.area_total >= ?'], ['areaMax', 'o.area_total <= ?'],
  ];
  for (const [key, cond] of numFilters) {
    const val = Number(q[key]);
    if (q[key] && Number.isFinite(val) && val > 0) {
      where.push(cond);
      params.push(val);
    }
  }

  return { where: where.join(' AND '), params };
}

function searchOffers(q, userId) {
  const { where, params } = buildFilters(q);
  const orderBy = SORTS[q.sort] || SORTS.default;
  const page = Math.max(1, parseInt(q.page, 10) || 1);

  const total = db.prepare(`SELECT COUNT(*) AS c FROM offers o WHERE ${where}`).get(...params).c;
  const offers = db.prepare(`
    SELECT o.*,
      (SELECT url FROM photos p WHERE p.offer_id = o.id ORDER BY position LIMIT 1) AS photo,
      (SELECT COUNT(*) FROM photos p WHERE p.offer_id = o.id) AS photo_count,
      ${userId ? 'EXISTS(SELECT 1 FROM favorites f WHERE f.offer_id = o.id AND f.user_id = ?)' : '0'} AS is_favorite
    FROM offers o
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...(userId ? [userId] : []), ...params, PER_PAGE, (page - 1) * PER_PAGE);

  return { offers, total, page, pages: Math.ceil(total / PER_PAGE), perPage: PER_PAGE };
}

function getOffer(id, userId) {
  const offer = db.prepare(`
    SELECT o.*, u.name AS seller_name, u.phone AS seller_phone, u.is_agent AS seller_is_agent,
      ${userId ? 'EXISTS(SELECT 1 FROM favorites f WHERE f.offer_id = o.id AND f.user_id = ?)' : '0'} AS is_favorite
    FROM offers o JOIN users u ON u.id = o.user_id
    WHERE o.id = ?
  `).get(...(userId ? [userId] : []), id);
  if (!offer) return null;
  offer.photos = db.prepare('SELECT url FROM photos WHERE offer_id = ? ORDER BY position').all(id);
  return offer;
}

function similarOffers(offer, limit = 4) {
  return db.prepare(`
    SELECT o.*,
      (SELECT url FROM photos p WHERE p.offer_id = o.id ORDER BY position LIMIT 1) AS photo
    FROM offers o
    WHERE o.is_active = 1 AND o.id != ? AND o.deal_type = ? AND o.offer_type = ? AND o.city = ?
    ORDER BY ABS(o.price - ?) ASC
    LIMIT ?
  `).all(offer.id, offer.deal_type, offer.offer_type, offer.city, offer.price, limit);
}

module.exports = { searchOffers, getOffer, similarOffers, PER_PAGE };
