/**
 * Cloudflare Worker: облачные сохранения «Проект Вавилон»
 *
 * Env vars (Cloudflare dashboard → Worker → Settings → Variables):
 *   BOT_TOKEN  — токен бота из BotFather (секрет, не разглашать)
 *   ADMIN_KEY  — произвольный секрет для защиты /admin (придумайте сами)
 *
 * KV namespace:
 *   SAVES — создать в dashboard и привязать к worker под именем SAVES
 *
 * Маршруты:
 *   GET  /save?user_id=<id>          → возвращает JSON сохранения (+ _pendingBonus/_refCount)
 *   POST /save  body: {initData, save} → верифицирует подпись Telegram, записывает save
 *   GET  /referrals                  → топ-10 рефереров (публичный)
 *   GET  /admin?key=<ADMIN_KEY>      → список всех игроков (только для админа)
 */

const ALLOWED_ORIGIN = 'https://logist888.github.io';

function corsHeaders(origin) {
  const allow = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Верификация initData по алгоритму Telegram WebApp
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function verifyInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const enc = new TextEncoder();

  // secret_key = HMAC-SHA256("WebAppData", bot_token)
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const secretKeyBytes = await crypto.subtle.sign('HMAC', baseKey, enc.encode(botToken));

  // signature = HMAC-SHA256(secret_key, data_check_string)
  const sigKey = await crypto.subtle.importKey(
    'raw', secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', sigKey, enc.encode(dataCheckString));

  const hexSig = [...new Uint8Array(sigBytes)]
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return hexSig === hash;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    // --- GET /save?user_id=123 ---
    if (url.pathname === '/save' && request.method === 'GET') {
      const userId = url.searchParams.get('user_id');
      if (!userId || !/^\d+$/.test(userId)) {
        return new Response('Bad user_id', { status: 400, headers });
      }
      const data = await env.SAVES.get(`save_${userId}`, 'json');
      if (data) {
        // Inject pending referral bonus (consume it so it's only delivered once)
        const bonus = await env.SAVES.get(`bonus_${userId}`, 'json');
        if (bonus) {
          data._pendingBonus = bonus;
          await env.SAVES.delete(`bonus_${userId}`);
        }
        // Inject current referral count
        const refs = await env.SAVES.get(`refs_${userId}`, 'json');
        if (refs) data._refCount = refs.count || 0;
      }
      return new Response(JSON.stringify(data || null), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    // --- POST /save  body: { initData, save } ---
    if (url.pathname === '/save' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch {
        return new Response('Invalid JSON', { status: 400, headers });
      }

      const { initData, save } = body;
      if (!initData || !save) {
        return new Response('Missing initData or save', { status: 400, headers });
      }

      // Верифицируем подпись
      const valid = await verifyInitData(initData, env.BOT_TOKEN);
      if (!valid) {
        return new Response('Unauthorized', { status: 401, headers });
      }

      // Извлекаем userId из initData (доверяем после верификации)
      const params = new URLSearchParams(initData);
      let userId;
      try {
        userId = JSON.parse(params.get('user')).id;
      } catch {
        return new Response('Cannot parse user', { status: 400, headers });
      }

      // Регистрируем реферал один раз (если игрок новый и пришёл по ссылке)
      const { referredBy, refRegistered } = save;
      if (referredBy && !refRegistered && String(referredBy) !== String(userId)) {
        save.refRegistered = true;

        // Увеличиваем счётчик рефералов у пригласившего
        const refKey = `refs_${referredBy}`;
        const existingRefs = await env.SAVES.get(refKey, 'json') || { count: 0, name: '' };
        existingRefs.count = (existingRefs.count || 0) + 1;
        const referrerSave = await env.SAVES.get(`save_${referredBy}`, 'json');
        if (referrerSave && referrerSave.name) existingRefs.name = referrerSave.name;
        await env.SAVES.put(refKey, JSON.stringify(existingRefs));

        // Начисляем 200 золота пригласившему
        const bonusKey = `bonus_${referredBy}`;
        const existingBonus = (await env.SAVES.get(bonusKey, 'json')) || 0;
        await env.SAVES.put(bonusKey, JSON.stringify(existingBonus + 200));
      }

      // Сохраняем (TTL 365 дней)
      await env.SAVES.put(`save_${userId}`, JSON.stringify(save), {
        expirationTtl: 60 * 60 * 24 * 365,
      });

      return new Response('OK', { headers });
    }

    // --- GET /referrals --- топ-10 рефереров (публичный)
    if (url.pathname === '/referrals' && request.method === 'GET') {
      const referrers = [];
      let cursor;
      do {
        const listed = await env.SAVES.list({ prefix: 'refs_', cursor });
        const entries = await Promise.all(
          listed.keys.map(async ({ name }) => {
            const data = await env.SAVES.get(name, 'json');
            return data ? { userId: name.slice(5), ...data } : null;
          })
        );
        referrers.push(...entries.filter(Boolean));
        cursor = listed.list_complete ? undefined : listed.cursor;
      } while (cursor);

      referrers.sort((a, b) => (b.count || 0) - (a.count || 0));

      return new Response(JSON.stringify(referrers.slice(0, 10)), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
        },
      });
    }

    // --- GET /admin?key=ADMIN_KEY ---
    if (url.pathname === '/admin' && request.method === 'GET') {
      const key = url.searchParams.get('key');
      if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
        return new Response('Forbidden', { status: 403, headers });
      }

      const players = [];
      let cursor;
      do {
        const listed = await env.SAVES.list({ prefix: 'save_', cursor });
        const entries = await Promise.all(
          listed.keys.map(async ({ name }) => {
            const data = await env.SAVES.get(name, 'json');
            return data ? { _userId: name.slice(5), ...data } : null;
          })
        );
        players.push(...entries.filter(Boolean));
        cursor = listed.list_complete ? undefined : listed.cursor;
      } while (cursor);

      players.sort((a, b) => (b.xp || 0) - (a.xp || 0));

      return new Response(JSON.stringify(players), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
        },
      });
    }

    return new Response('Not found', { status: 404, headers });
  },
};
