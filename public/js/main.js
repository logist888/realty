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

  // --- Карта на странице объявления (Leaflet + OpenStreetMap) ---
  const mapEl = document.getElementById('map');
  if (mapEl && window.L) {
    const lat = Number(mapEl.dataset.lat);
    const lng = Number(mapEl.dataset.lng);
    const map = L.map(mapEl, { scrollWheelZoom: false }).setView([lat, lng], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.marker([lat, lng]).addTo(map)
      .bindPopup(`<strong>${mapEl.dataset.title}</strong><br>${mapEl.dataset.address}`);
  }

  // --- Автоподсказки адреса (геокодер Photon / OpenStreetMap) ---
  const addressInput = document.getElementById('address-input');
  const suggestBox = document.getElementById('address-suggest');
  if (addressInput && suggestBox) {
    const cityInput = document.getElementById('city-input');
    const latInput = document.getElementById('lat-input');
    const lngInput = document.getElementById('lng-input');
    const geoStatus = document.getElementById('geo-status');
    let debounceTimer = null;
    let abortCtrl = null;
    let selecting = false;

    function setCoords(lat, lng) {
      latInput.value = lat || '';
      lngInput.value = lng || '';
      if (lat) {
        document.getElementById('geo-coords').textContent =
          Number(lat).toFixed(5) + ', ' + Number(lng).toFixed(5);
        geoStatus.hidden = false;
      } else {
        geoStatus.hidden = true;
      }
    }

    function labelFor(props) {
      const street = [props.street || props.name, props.housenumber].filter(Boolean).join(', ');
      const place = [props.city || props.county, props.state].filter(Boolean).join(', ');
      return { street, place };
    }

    // Подсказка относится к выбранному городу? (город, посёлок или регион в свойствах)
    function matchesCity(props, cityVal) {
      if (!cityVal) return true;
      const needle = cityVal.trim().toLowerCase();
      return [props.city, props.town, props.village, props.county, props.state, props.district]
        .filter(Boolean)
        .some(v => v.toLowerCase().includes(needle) || needle.includes(v.toLowerCase()));
    }

    async function fetchSuggestions(query) {
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();
      const cityVal = cityInput ? cityInput.value.trim() : '';
      const url = 'https://photon.komoot.io/api/?limit=10&lang=default&q=' +
        encodeURIComponent((cityVal ? cityVal + ', ' : '') + query);
      try {
        const res = await fetch(url, { signal: abortCtrl.signal });
        if (!res.ok) return;
        const data = await res.json();
        // Оставляем только адреса в выбранном городе
        const features = (data.features || []).filter(f => matchesCity(f.properties || {}, cityVal));
        renderSuggestions(features.slice(0, 6));
      } catch (_) { /* геокодер недоступен — ввод остаётся ручным */ }
    }

    function renderSuggestions(features) {
      suggestBox.innerHTML = '';
      const usable = features.filter(f => f.geometry && f.properties);
      if (!usable.length) { suggestBox.hidden = true; return; }
      usable.forEach((f) => {
        const { street, place } = labelFor(f.properties);
        if (!street) return;
        const item = document.createElement('div');
        item.className = 'suggest-item';
        item.innerHTML = `<span class="suggest-street"></span> <span class="suggest-place"></span>`;
        item.querySelector('.suggest-street').textContent = street;
        item.querySelector('.suggest-place').textContent = place;
        item.addEventListener('mousedown', () => {
          selecting = true;
          addressInput.value = street;
          if (cityInput && !cityInput.value && f.properties.city) cityInput.value = f.properties.city;
          // Район подтягиваем из геокодера, если поле есть, видимо и не заполнено
          const districtInput = document.getElementById('district-input');
          if (districtInput && !districtInput.value && !districtInput.closest('[data-types]').hidden
              && f.properties.district) {
            districtInput.value = f.properties.district;
          }
          const [lng, lat] = f.geometry.coordinates;
          setCoords(lat, lng);
          suggestBox.hidden = true;
          setTimeout(() => { selecting = false; }, 100);
        });
        suggestBox.appendChild(item);
      });
      suggestBox.hidden = suggestBox.children.length === 0;
    }

    addressInput.addEventListener('input', () => {
      if (selecting) return;
      setCoords('', ''); // адрес изменён вручную — старые координаты недействительны
      clearTimeout(debounceTimer);
      const query = addressInput.value.trim();
      if (query.length < 3) { suggestBox.hidden = true; return; }
      debounceTimer = setTimeout(() => fetchSuggestions(query), 300);
    });
    addressInput.addEventListener('blur', () => {
      setTimeout(() => { suggestBox.hidden = true; }, 150);
    });
    addressInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') suggestBox.hidden = true;
    });
  }

  // --- Мастер размещения объявления: шаги, валидация, поля по типу ---
  const wizardForm = document.getElementById('offer-form');
  if (wizardForm) {
    const steps = Array.from(wizardForm.querySelectorAll('.wizard-step'));
    const progress = Array.from(document.querySelectorAll('#wizard-progress .wstep'));
    const backBtn = document.getElementById('wizard-back');
    const nextBtn = document.getElementById('wizard-next');
    const submitBtn = document.getElementById('wizard-submit');
    let current = 0;

    function applyTypeVisibility() {
      const checked = wizardForm.querySelector('input[name="offer_type"]:checked');
      const type = checked ? checked.value : 'flat';
      wizardForm.querySelectorAll('[data-types]').forEach((el) => {
        el.hidden = !el.dataset.types.split(',').includes(type);
      });
    }
    wizardForm.querySelectorAll('input[name="offer_type"]').forEach((radio) =>
      radio.addEventListener('change', applyTypeVisibility));
    applyTypeVisibility();

    function showStep(index) {
      current = index;
      steps.forEach((s, i) => { s.hidden = i !== index; });
      progress.forEach((p, i) => {
        p.classList.toggle('active', i === index);
        p.classList.toggle('done', i < index);
      });
      backBtn.hidden = index === 0;
      nextBtn.hidden = index === steps.length - 1;
      submitBtn.hidden = index !== steps.length - 1;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Все видимые поля текущего шага должны пройти браузерную валидацию
    function validateStep(index) {
      const fields = steps[index].querySelectorAll('input, select, textarea');
      for (const field of fields) {
        if (field.closest('[hidden]')) continue;
        if (!field.checkValidity()) {
          field.reportValidity();
          return false;
        }
      }
      return true;
    }

    nextBtn.addEventListener('click', () => {
      if (validateStep(current)) showStep(current + 1);
    });
    backBtn.addEventListener('click', () => showStep(current - 1));

    // Клик по пройденному шагу в прогресс-баре возвращает к нему
    progress.forEach((p, i) => p.addEventListener('click', () => {
      if (i < current) showStep(i);
      else if (i > current && validateStep(current)) showStep(current + 1);
    }));

    // Enter не отправляет форму с промежуточного шага
    wizardForm.addEventListener('submit', (e) => {
      if (current !== steps.length - 1) {
        e.preventDefault();
        if (validateStep(current)) showStep(current + 1);
      }
    });

    showStep(0);
  }

  // --- Drag & drop загрузка фотографий с превью ---
  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    const input = document.getElementById('photos-input');
    const previews = document.getElementById('photo-previews');
    const store = new DataTransfer();
    const MAX_FILES = 10;
    const MAX_SIZE = 8 * 1024 * 1024;

    function syncInput() {
      input.files = store.files;
    }

    function renderPreviews() {
      previews.innerHTML = '';
      Array.from(store.files).forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'photo-preview';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.onload = () => URL.revokeObjectURL(img.src);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'photo-remove';
        remove.textContent = '×';
        remove.title = 'Убрать фото';
        remove.addEventListener('click', () => {
          const dt = new DataTransfer();
          Array.from(store.files).forEach((f, i) => { if (i !== index) dt.items.add(f); });
          store.items.clear();
          Array.from(dt.files).forEach(f => store.items.add(f));
          syncInput();
          renderPreviews();
        });
        item.appendChild(img);
        item.appendChild(remove);
        previews.appendChild(item);
      });
    }

    function addFiles(fileList) {
      let rejected = 0;
      Array.from(fileList).forEach((file) => {
        if (store.files.length >= MAX_FILES) { rejected++; return; }
        if (!file.type.startsWith('image/') || file.size > MAX_SIZE) { rejected++; return; }
        store.items.add(file);
      });
      syncInput();
      renderPreviews();
      if (rejected) {
        dropzone.classList.add('dropzone-error');
        setTimeout(() => dropzone.classList.remove('dropzone-error'), 1200);
      }
    }

    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', () => {
      // файлы из диалога добавляем к уже выбранным, а не заменяем
      const chosen = Array.from(input.files);
      input.value = '';
      addFiles(chosen);
    });
    ['dragenter', 'dragover'].forEach(evt =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('dropzone-over');
      }));
    ['dragleave', 'drop'].forEach(evt =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dropzone-over');
      }));
    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });
  }

  // --- Фильтр «Комнат» скрывается для нежилых типов ---
  const searchType = document.getElementById('search-type');
  const roomsGroup = document.getElementById('rooms-group');
  if (searchType && roomsGroup && window.NON_RESIDENTIAL) {
    searchType.addEventListener('change', () => {
      const hide = window.NON_RESIDENTIAL.includes(searchType.value);
      roomsGroup.hidden = hide;
      if (hide) roomsGroup.querySelectorAll('input:checked').forEach(cb => { cb.checked = false; });
    });
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
        metroGroup.hidden = info.metro.length === 0;
      } else {
        districtGroup.hidden = true;
        metroGroup.hidden = true;
        districtSelect.value = '';
        metroSelect.value = '';
      }
    });
  }
})();
