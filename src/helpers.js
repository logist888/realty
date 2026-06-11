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
};

const RENOVATIONS = ['без ремонта', 'косметический', 'евроремонт', 'дизайнерский'];

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
};

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

function offerTitle(offer) {
  const base = offer.offer_type === 'house'
    ? `Дом, ${offer.area_total} м²`
    : `${roomsLabel(offer)} ${offer.offer_type === 'flat' ? 'квартира, ' : ''}${offer.area_total} м²`;
  const floor = offer.floor ? `, ${offer.floor}/${offer.floors_total} этаж` : '';
  return base + floor;
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
  DEAL_TYPES, OFFER_TYPES, RENOVATIONS, CITIES,
  formatPrice, plural, roomsLabel, offerTitle, timeAgo,
};
