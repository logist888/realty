const DEAL_TYPES = {
  sale: 'Купить',
  rent_long: 'Снять',
  rent_daily: 'Посуточно',
};

const OFFER_TYPES = {
  flat: 'Квартира',
  room: 'Комната',
  house: 'Дом',
  commercial: 'Коммерческая',
  storage: 'Кладовая',
  parking: 'Машиноместо',
};

// Типы без жилых характеристик (комнаты, балкон, жилая площадь)
const NON_RESIDENTIAL = ['commercial', 'storage', 'parking'];

const RENOVATIONS = ['без ремонта', 'косметический', 'евроремонт', 'дизайнерский'];

// Назначение коммерческого помещения
const PURPOSES = ['офис', 'торговая площадь', 'склад', 'общепит', 'производство', 'свободное назначение'];

const PARKING_TYPES = ['подземный', 'многоуровневый', 'открытый', 'гараж'];

const CITIES = {
  'Москва': {
    districts: ['ЦАО', 'САО', 'СВАО', 'ВАО', 'ЮВАО', 'ЮАО', 'ЮЗАО', 'ЗАО', 'СЗАО'],
    metro: ['Арбатская', 'Таганская', 'Сокол', 'Бауманская', 'Профсоюзная', 'Тверская',
      'Кузьминки', 'Марьино', 'Беляево', 'Щукинская', 'Аэропорт', 'Октябрьская',
      'Динамо', 'Войковская', 'Новокузнецкая', 'Парк культуры', 'Преображенская площадь'],
    center: [55.7558, 37.6173],
  },
  'Санкт-Петербург': {
    districts: ['Центральный', 'Адмиралтейский', 'Василеостровский', 'Петроградский',
      'Выборгский', 'Московский', 'Невский', 'Приморский'],
    metro: ['Невский проспект', 'Василеостровская', 'Петроградская', 'Московская',
      'Чёрная речка', 'Площадь Восстания', 'Озерки', 'Академическая'],
    center: [59.9343, 30.3351],
  },
  'Екатеринбург': {
    districts: ['Верх-Исетский', 'Кировский', 'Ленинский', 'Октябрьский', 'Чкаловский'],
    metro: ['Площадь 1905 года', 'Геологическая', 'Динамо', 'Уралмаш', 'Ботаническая'],
    center: [56.8389, 60.6057],
  },
  'Химки': {
    districts: ['Центральный', 'Новогорск', 'Сходня', 'Левобережный'],
    metro: ['Планерная', 'Речной вокзал'],
    center: [55.8970, 37.4297],
  },
  'Балашиха': {
    districts: ['Центральный', 'Железнодорожный', 'Салтыковка'],
    metro: ['Новокосино', 'Щёлковская'],
    center: [55.7969, 37.9381],
  },
  'Подольск': {
    districts: ['Центральный', 'Климовск', 'Кузнечики'],
    metro: [],
    center: [55.4312, 37.5447],
  },
};

// Города Московской области — для региональных фильтров поиска
const MO_CITIES = ['Балашиха', 'Подольск', 'Химки', 'Мытищи', 'Королёв', 'Люберцы',
  'Красногорск', 'Одинцово', 'Щёлково', 'Домодедово', 'Серпухов', 'Раменское',
  'Долгопрудный', 'Реутов', 'Жуковский', 'Пушкино', 'Сергиев Посад', 'Видное',
  'Ивантеевка', 'Дмитров', 'Коломна', 'Клин', 'Лобня', 'Дзержинский', 'Котельники'];

// Региональные значения фильтра «Город» в поиске
const REGION_FILTERS = ['Московская область', 'Москва и Московская область'];

// Справочник городов России для автодополнения (Москва — первая)
const RU_CITIES = ['Москва', 'Санкт-Петербург',
  ...MO_CITIES,
  'Архангельск', 'Астрахань', 'Барнаул', 'Белгород', 'Брянск', 'Великий Новгород',
  'Владивосток', 'Владимир', 'Волгоград', 'Вологда', 'Воронеж', 'Грозный',
  'Екатеринбург', 'Иваново', 'Ижевск', 'Иркутск', 'Йошкар-Ола', 'Казань',
  'Калининград', 'Калуга', 'Кемерово', 'Киров', 'Краснодар', 'Красноярск',
  'Курган', 'Курск', 'Липецк', 'Махачкала', 'Мурманск', 'Набережные Челны',
  'Нижний Новгород', 'Новокузнецк', 'Новосибирск', 'Омск', 'Орёл', 'Оренбург',
  'Пенза', 'Пермь', 'Псков', 'Ростов-на-Дону', 'Рязань', 'Самара', 'Саратов',
  'Севастополь', 'Смоленск', 'Сочи', 'Ставрополь', 'Тамбов', 'Тверь', 'Тольятти',
  'Томск', 'Тула', 'Тюмень', 'Улан-Удэ', 'Ульяновск', 'Уфа', 'Хабаровск',
  'Чебоксары', 'Челябинск', 'Чита', 'Якутск', 'Ярославль'];

function formatPrice(price, dealType) {
  const formatted = price.toLocaleString('ru-RU');
  if (dealType === 'rent_long') return `${formatted} ₽/мес.`;
  if (dealType === 'rent_daily') return `${formatted} ₽/сутки`;
  return `${formatted} ₽`;
}

function plural(n, one, few, many) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function roomsLabel(offer) {
  if (offer.offer_type === 'room') return 'Комната';
  if (offer.offer_type === 'commercial') return 'Помещение';
  if (offer.rooms === 0) return 'Студия';
  return `${offer.rooms}-комн.`;
}

// Подпись этажа: 0 — цокольный, отрицательные — подземные
function floorLabel(floor) {
  if (floor === 0) return 'цоколь';
  return String(floor);
}

function offerTitle(offer) {
  let base;
  switch (offer.offer_type) {
    case 'house':
      base = `Дом, ${offer.area_total} м²`;
      break;
    case 'storage':
      base = `Кладовая, ${offer.area_total} м²`;
      break;
    case 'parking':
      base = `Машиноместо, ${offer.area_total} м²`;
      break;
    case 'commercial': {
      const purpose = offer.purpose ? offer.purpose[0].toUpperCase() + offer.purpose.slice(1) : 'Помещение';
      base = `${purpose}, ${offer.area_total} м²`;
      break;
    }
    case 'room':
      base = `Комната, ${offer.area_total} м²`;
      break;
    default:
      base = `${offer.rooms === 0 ? 'Студия' : offer.rooms + '-комн. квартира'}, ${offer.area_total} м²`;
  }
  if (offer.floor != null) {
    base += offer.floors_total
      ? `, ${floorLabel(offer.floor)}/${offer.floors_total} этаж`
      : `, ${floorLabel(offer.floor)} этаж`;
  }
  return base;
}

function timeAgo(isoDate) {
  const diffMs = Date.now() - new Date(isoDate + 'Z').getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} ${plural(mins, 'минуту', 'минуты', 'минут')} назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${plural(hours, 'час', 'часа', 'часов')} назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
  return new Date(isoDate + 'Z').toLocaleDateString('ru-RU');
}

module.exports = {
  DEAL_TYPES, OFFER_TYPES, NON_RESIDENTIAL, RENOVATIONS, PURPOSES, PARKING_TYPES,
  CITIES, MO_CITIES, REGION_FILTERS, RU_CITIES,
  formatPrice, plural, roomsLabel, floorLabel, offerTitle, timeAgo,
};
