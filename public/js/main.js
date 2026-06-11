// Клиентская логика: избранное, телефон, галерея, ипотека, динамические фильтры
(function () {
  'use strict';

  // --- Избранное (карточки и страница объявления) ---
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.fav-btn, .fav-btn-big');
    if (!btn) return;
    e.preventDefault();
    const id = btn.dataset.offerId;
    try {
      const res = await fetch(`/api/favorites/${id}`, { method: 'POST' });
      if (res.status === 401) {
        window.location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search);
        return;
      }
      const data = await res.json();
      btn.classList.toggle('active', data.favorite);
      if (btn.classList.contains('fav-btn-big')) {
        btn.textContent = data.favorite ? '♥ В избранном' : '♡ В избранное';
      } else {
        btn.innerHTML = data.favorite ? '&#9829;' : '&#9825;';
      }
    } catch (_) { /* сеть недоступна — молча игнорируем */ }
  });

  // --- Показ телефона продавца ---
  const phoneBtn = document.getElementById('show-phone');
  if (phoneBtn) {
    phoneBtn.addEventListener('click', async () => {
      const res = await fetch(`/api/offers/${phoneBtn.dataset.offerId}/phone`);
      if (!res.ok) return;
      const data = await res.json();
      phoneBtn.outerHTML = `<a href="tel:${data.phone.replace(/[^+\d]/g, '')}" class="btn btn-accent btn-block">${data.phone}</a>`;
    });
  }

  // --- Галерея фотографий ---
  const gallery = document.getElementById('gallery');
  if (gallery) {
    const main = document.getElementById('gallery-main');
    gallery.querySelectorAll('.gallery-thumbs img').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        main.src = thumb.src;
        gallery.querySelectorAll('.gallery-thumbs img').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });
  }

  // --- Ипотечный калькулятор ---
  const mortgage = document.querySelector('.mortgage');
  if (mortgage) {
    const price = Number(mortgage.dataset.price);
    const down = document.getElementById('mort-down');
    const years = document.getElementById('mort-years');
    const rate = document.getElementById('mort-rate');
    const out = document.getElementById('mort-payment');

    function recalc() {
      const principal = price - (Number(down.value) || 0);
      const months = (Number(years.value) || 20) * 12;
      const monthlyRate = (Number(rate.value) || 16) / 100 / 12;
      if (principal <= 0) { out.textContent = '0 ₽'; return; }
      const payment = monthlyRate === 0
        ? principal / months
        : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
      out.textContent = Math.round(payment).toLocaleString('ru-RU') + ' ₽';
    }
    [down, years, rate].forEach(el => el.addEventListener('input', recalc));
    recalc();
  }

  // --- Динамическая подстановка районов и метро при смене города ---
  const citySelect = document.getElementById('city-select');
  if (citySelect && window.CITY_DATA) {
    citySelect.addEventListener('change', () => {
      const info = window.CITY_DATA[citySelect.value];
      const districtGroup = document.getElementById('district-group');
      const metroGroup = document.getElementById('metro-group');
      const districtSelect = districtGroup.querySelector('select');
      const metroSelect = metroGroup.querySelector('select');

      function fill(select, items) {
        select.innerHTML = '<option value="">' + select.options[0].text + '</option>';
        items.forEach((item) => {
          const opt = document.createElement('option');
          opt.value = item;
          opt.textContent = item;
          select.appendChild(opt);
        });
      }
      if (info) {
        fill(districtSelect, info.districts);
        fill(metroSelect, info.metro);
        districtGroup.hidden = false;
        metroGroup.hidden = false;
      } else {
        districtGroup.hidden = true;
        metroGroup.hidden = true;
        districtSelect.value = '';
        metroSelect.value = '';
      }
    });
  }
})();
