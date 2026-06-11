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
  offer_type   TEXT NOT NULL CHECK (offer_type IN ('flat','room','house','commercial','storage','parking')),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  price        INTEGER NOT NULL,
  rooms        INTEGER NOT NULL DEFAULT 1,      -- 0 = студия
  area_total   REAL NOT NULL,
  area_living  REAL,
  area_kitchen REAL,
  floor        INTEGER,                          -- -10..-1 подземные, 0 цоколь
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
  purpose      TEXT NOT NULL DEFAULT '',        -- назначение коммерческого помещения
  parking_type TEXT NOT NULL DEFAULT '',        -- подземный / многоуровневый / открытый / гараж
  ceiling_height REAL,                          -- высота потолков, м
  security     INTEGER NOT NULL DEFAULT 0,      -- охрана / видеонаблюдение
  separate_entrance INTEGER NOT NULL DEFAULT 0, -- отдельный вход (коммерческая)
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

// Миграция баз, созданных до появления кладовых/машиномест:
// SQLite не умеет менять CHECK, поэтому пересоздаём таблицу с переносом данных.
const offersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='offers'").get().sql;
if (!offersSql.includes("'storage'")) {
  const oldColumns = db.prepare('PRAGMA table_info(offers)').all().map(c => c.name);
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec('ALTER TABLE offers RENAME TO offers_old');
    const newTableSql = offersSql
      .replace("'flat','room','house','commercial'", "'flat','room','house','commercial','storage','parking'")
      .replace(/,\s*is_active/,
        `, purpose TEXT NOT NULL DEFAULT '', parking_type TEXT NOT NULL DEFAULT '',
         ceiling_height REAL, security INTEGER NOT NULL DEFAULT 0,
         separate_entrance INTEGER NOT NULL DEFAULT 0, is_active`);
    db.exec(newTableSql);
    const cols = oldColumns.join(', ');
    db.exec(`INSERT INTO offers (${cols}) SELECT ${cols} FROM offers_old`);
    db.exec('DROP TABLE offers_old');
    db.exec(`CREATE INDEX IF NOT EXISTS idx_offers_search
      ON offers (is_active, deal_type, offer_type, city, price)`);
  })();
  db.pragma('foreign_keys = ON');
}

module.exports = db;
