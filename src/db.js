const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'realty.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  is_agent      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deal_type    TEXT NOT NULL CHECK (deal_type IN ('sale','rent_long','rent_daily')),
  offer_type   TEXT NOT NULL CHECK (offer_type IN ('flat','room','house','commercial')),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  price        INTEGER NOT NULL,
  rooms        INTEGER NOT NULL DEFAULT 1,      -- 0 = студия
  area_total   REAL NOT NULL,
  area_living  REAL,
  area_kitchen REAL,
  floor        INTEGER,
  floors_total INTEGER,
  build_year   INTEGER,
  city         TEXT NOT NULL,
  district     TEXT NOT NULL DEFAULT '',
  address      TEXT NOT NULL,
  metro        TEXT NOT NULL DEFAULT '',
  metro_minutes INTEGER,
  lat          REAL,
  lng          REAL,
  renovation   TEXT NOT NULL DEFAULT '',        -- косметический / евро / дизайнерский / без ремонта
  balcony      INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  views        INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS photos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  url      TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_offers_search
  ON offers (is_active, deal_type, offer_type, city, price);
CREATE INDEX IF NOT EXISTS idx_photos_offer ON photos (offer_id, position);
`);

module.exports = db;
