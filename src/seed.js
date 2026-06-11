// Заполнение базы демо-данными: пользователи и ~150 объявлений.
// Запуск: npm run seed
const db = require('./db');
const { hashPassword } = require('./auth');
const { CITIES, RENOVATIONS } = require('./helpers');

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
    city, district, address, metro, metro_minutes, lat, lng, renovation, balcony, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`);
const insertPhoto = db.prepare('INSERT INTO photos (offer_id, url, position) VALUES (?, ?, ?)');

const seedAll = db.transaction(() => {
  for (let i = 0; i < 150; i++) {
    const city = pick(Object.keys(CITIES));
    const cityInfo = CITIES[city];
    const dealType = pick(['sale', 'sale', 'sale', 'rent_long', 'rent_long', 'rent_daily']);
    const offerType = pick(['flat', 'flat', 'flat', 'flat', 'room', 'house', 'commercial']);

    const rooms = offerType === 'room' ? 1 : pick([0, 1, 1, 2, 2, 3, 3, 4, 5]);
    let areaTotal;
    if (offerType === 'house') areaTotal = rand(80, 350);
    else if (offerType === 'room') areaTotal = rand(10, 25);
    else if (offerType === 'commercial') areaTotal = rand(30, 500);
    else areaTotal = rooms === 0 ? rand(22, 35) : 18 + rooms * rand(14, 22);

    // Цена за м² зависит от города и типа сделки
    const cityFactor = city === 'Москва' ? 1 : city === 'Санкт-Петербург' ? 0.7 : 0.4;
    let price;
    if (dealType === 'sale') price = Math.round(areaTotal * rand(180, 420) * 1000 * cityFactor / 10000) * 10000;
    else if (dealType === 'rent_long') price = Math.round(areaTotal * rand(900, 2200) * cityFactor / 1000) * 1000;
    else price = Math.round(areaTotal * rand(120, 300) * cityFactor / 100) * 100;

    const floorsTotal = offerType === 'house' ? rand(1, 3) : rand(5, 30);
    const floor = offerType === 'house' ? null : rand(1, floorsTotal);
    const [clat, clng] = cityInfo.center;

    const offerId = insertOffer.run(
      pick(userIds), dealType, offerType, '', pick(DESCRIPTIONS), price, rooms,
      areaTotal,
      offerType === 'flat' ? Math.round(areaTotal * 0.55) : null,
      offerType === 'flat' ? rand(6, 20) : null,
      floor, offerType === 'house' ? null : floorsTotal,
      rand(1960, 2025),
      city, pick(cityInfo.districts),
      `ул. ${pick(STREETS)}, д. ${rand(1, 120)}`,
      offerType === 'house' ? '' : pick(cityInfo.metro),
      offerType === 'house' ? null : rand(2, 25),
      clat + (Math.random() - 0.5) * 0.25,
      clng + (Math.random() - 0.5) * 0.4,
      pick(RENOVATIONS), pick([0, 1, 1]),
      `-${rand(0, 45)} days`,
    ).lastInsertRowid;

    const photoCount = rand(3, 6);
    for (let p = 0; p < photoCount; p++) {
      insertPhoto.run(offerId, `/img/ph/${offerId}-${p}.svg`, p);
    }
  }
});
seedAll();

console.log('Готово: 5 пользователей (пароль demo1234), 150 объявлений.');
console.log('Демо-аккаунт: demo@realty.local / demo1234');
