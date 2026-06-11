// Заполнение базы демо-данными: пользователи и ~150 объявлений.
// Запуск: npm run seed
const db = require('./db');
const { hashPassword } = require('./auth');
const { CITIES, RENOVATIONS, PURPOSES, PARKING_TYPES } = require('./helpers');

const offersCount = db.prepare('SELECT COUNT(*) AS c FROM offers').get().c;
if (offersCount > 0) {
  console.log(`База уже содержит ${offersCount} объявлений, сидирование пропущено.`);
  process.exit(0);
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }

const insertUser = db.prepare(`
  INSERT INTO users (email, name, phone, password_hash, is_agent) VALUES (?, ?, ?, ?, ?)`);
const demoUsers = [
  ['demo@realty.local', 'Демо Пользователь', '+7 (900) 123-45-67', 0],
  ['anna.agent@realty.local', 'Анна Соколова', '+7 (916) 555-12-34', 1],
  ['ivan.agent@realty.local', 'Иван Орлов', '+7 (921) 777-88-99', 1],
  ['maria@realty.local', 'Мария Кузнецова', '+7 (903) 222-33-44', 0],
  ['sergey@realty.local', 'Сергей Волков', '+7 (985) 444-55-66', 0],
];
const userIds = demoUsers.map(([email, name, phone, isAgent]) =>
  insertUser.run(email, name, phone, hashPassword('demo1234'), isAgent).lastInsertRowid);

const STREETS = ['Ленина', 'Садовая', 'Лесная', 'Центральная', 'Мира', 'Пушкина',
  'Гагарина', 'Набережная', 'Солнечная', 'Парковая', 'Молодёжная', 'Зелёная'];

const NON_RES_DESCRIPTIONS = [
  'Сухое отапливаемое помещение с круглосуточным доступом. Видеонаблюдение, охрана на въезде в паркинг.',
  'Удобный заезд, широкие проезды. Помещение в собственности, документы готовы к сделке.',
  'Закрытая территория жилого комплекса, доступ по ключ-карте. Рядом лифт, удобно спускаться из квартиры.',
  'Помещение с хорошей вентиляцией и освещением. Возможна долгосрочная аренда со скидкой.',
];

const DESCRIPTIONS = [
  'Светлая и уютная квартира с продуманной планировкой. Окна выходят во двор, тихо. Развитая инфраструктура: школы, детские сады, магазины в шаговой доступности.',
  'Отличное состояние, заезжай и живи. Остаётся вся мебель и техника. Закрытый двор, консьерж, подземный паркинг.',
  'Просторное жильё в доме комфорт-класса. Большая кухня-гостиная, тёплые полы в санузле. Рядом парк и набережная.',
  'Квартира после капитального ремонта. Новая электрика и сантехника. Один взрослый собственник, документы готовы, быстрый выход на сделку.',
  'Видовые окна, высокие потолки. До метро 5 минут пешком. Возможна ипотека любого банка, поможем с одобрением.',
  'Тёплый и тихий дом, дружелюбные соседи. Свежий косметический ремонт, новая кухня. Торг уместен при быстрой сделке.',
];

const insertOffer = db.prepare(`
  INSERT INTO offers (user_id, deal_type, offer_type, title, description, price, rooms,
    area_total, area_living, area_kitchen, floor, floors_total, build_year,
    city, district, address, metro, metro_minutes, lat, lng, renovation, balcony,
    purpose, parking_type, ceiling_height, security, separate_entrance, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`);
const insertPhoto = db.prepare('INSERT INTO photos (offer_id, url, position) VALUES (?, ?, ?)');

const seedAll = db.transaction(() => {
  for (let i = 0; i < 180; i++) {
    const city = pick(Object.keys(CITIES));
    const cityInfo = CITIES[city];
    const dealType = pick(['sale', 'sale', 'sale', 'rent_long', 'rent_long', 'rent_daily']);
    // Акцент на нежилые: коммерческие, кладовые и машиноместа — около половины базы
    const offerType = pick(['flat', 'flat', 'flat', 'room', 'house',
      'commercial', 'commercial', 'storage', 'storage', 'parking', 'parking']);
    const nonRes = ['commercial', 'storage', 'parking'].includes(offerType);

    const rooms = nonRes ? 0 : offerType === 'room' ? 1 : pick([0, 1, 1, 2, 2, 3, 3, 4, 5]);
    let areaTotal;
    if (offerType === 'house') areaTotal = rand(80, 350);
    else if (offerType === 'room') areaTotal = rand(10, 25);
    else if (offerType === 'commercial') areaTotal = rand(30, 500);
    else if (offerType === 'storage') areaTotal = rand(2, 14);
    else if (offerType === 'parking') areaTotal = rand(12, 20);
    else areaTotal = rooms === 0 ? rand(22, 35) : 18 + rooms * rand(14, 22);

    // Цена за м² зависит от города, типа объекта и сделки
    const CITY_FACTORS = {
      'Москва': 1, 'Санкт-Петербург': 0.7, 'Екатеринбург': 0.4,
      'Химки': 0.6, 'Балашиха': 0.5, 'Подольск': 0.45,
    };
    const cityFactor = CITY_FACTORS[city] || 0.4;
    let price;
    if (offerType === 'storage') {
      price = dealType === 'sale'
        ? Math.round(rand(250, 1200) * 1000 * cityFactor / 10000) * 10000
        : Math.round(rand(1500, 7000) * cityFactor / 100) * 100;
    } else if (offerType === 'parking') {
      price = dealType === 'sale'
        ? Math.round(rand(700, 4000) * 1000 * cityFactor / 10000) * 10000
        : Math.round(rand(3000, 15000) * cityFactor / 100) * 100;
    } else if (dealType === 'sale') {
      price = Math.round(areaTotal * rand(180, 420) * 1000 * cityFactor / 10000) * 10000;
    } else if (dealType === 'rent_long') {
      price = Math.round(areaTotal * rand(900, 2200) * cityFactor / 1000) * 1000;
    } else {
      price = Math.round(areaTotal * rand(120, 300) * cityFactor / 100) * 100;
    }

    // Этажи: кладовые и машиноместа — подземные (-3..-1), коммерческие — включая цоколь (0)
    const floorsTotal = offerType === 'house' ? rand(1, 3) : rand(5, 30);
    let floor;
    if (offerType === 'house') floor = null;
    else if (offerType === 'storage' || offerType === 'parking') floor = rand(-3, -1);
    else if (offerType === 'commercial') floor = pick([-1, 0, 0, 1, 1, 1, 2]);
    else floor = rand(1, floorsTotal);

    const [clat, clng] = cityInfo.center;

    const offerId = insertOffer.run(
      pick(userIds), dealType, offerType, '',
      nonRes ? pick(NON_RES_DESCRIPTIONS) : pick(DESCRIPTIONS),
      price, rooms, areaTotal,
      offerType === 'flat' ? Math.round(areaTotal * 0.55) : null,
      offerType === 'flat' ? rand(6, 20) : null,
      floor, offerType === 'house' ? null : floorsTotal,
      offerType === 'storage' || offerType === 'parking' ? null : rand(1960, 2025),
      city, nonRes ? '' : pick(cityInfo.districts),
      `ул. ${pick(STREETS)}, д. ${rand(1, 120)}`,
      offerType !== 'house' && cityInfo.metro.length ? pick(cityInfo.metro) : '',
      offerType !== 'house' && cityInfo.metro.length ? rand(2, 25) : null,
      clat + (Math.random() - 0.5) * 0.25,
      clng + (Math.random() - 0.5) * 0.4,
      nonRes ? '' : pick(RENOVATIONS),
      nonRes ? 0 : pick([0, 1, 1]),
      offerType === 'commercial' ? pick(PURPOSES) : '',
      offerType === 'parking' ? pick(PARKING_TYPES) : '',
      nonRes ? rand(22, 45) / 10 : null,
      nonRes ? pick([0, 1, 1]) : 0,
      offerType === 'commercial' ? pick([0, 1]) : 0,
      `-${rand(0, 45)} days`,
    ).lastInsertRowid;

    const photoCount = rand(3, 6);
    for (let p = 0; p < photoCount; p++) {
      insertPhoto.run(offerId, `/img/ph/${offerId}-${p}.svg`, p);
    }
  }
});
seedAll();

console.log('Готово: 5 пользователей (пароль demo1234), 180 объявлений.');
console.log('Демо-аккаунт: demo@realty.local / demo1234');
