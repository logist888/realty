# Облачные сохранения «Вавилон» — Cloudflare Worker

Серверная часть игры: облачные сохранения, реферальная программа, зал славы,
PvP-арена и Telegram-уведомления. Состояние игрока хранится в Cloudflare KV и
привязано к Telegram-аккаунту, поэтому прогресс не теряется при смене устройства
или очистке кэша (в отличие от чистого `localStorage`).

## Файлы

```
save-worker.js   — код воркера (все маршруты + cron)
wrangler.toml    — конфигурация для деплоя через CLI
```

## Что хранится в KV (namespace SAVES)

| Префикс ключа     | Значение                                                        |
|-------------------|-----------------------------------------------------------------|
| `save_<userId>`   | полный объект сохранения игрока (TTL 365 дней)                   |
| `refs_<userId>`   | `{ count, name }` — сколько игроков пригласил                    |
| `bonus_<userId>`  | накопленный реферальный бонус (золото), выдаётся при следующем входе |
| `hpnotify_<userId>` | `{ chatId, name, notifyAt }` — отложенное HP-уведомление       |

Новые поля сохранения (ресурсы 3 уровня, `counters.bossKills`, `pvp`, изученные
легендарные рецепты) **не требуют изменений воркера** — он пишет и читает объект
сохранения целиком.

## Маршруты

| Метод + путь            | Назначение                                              |
|-------------------------|---------------------------------------------------------|
| `GET /save?user_id=`    | вернуть сохранение (+ `_pendingBonus`, `_refCount`)      |
| `POST /save`            | проверить подпись Telegram и записать сохранение         |
| `POST /notify`          | уведомление о новом уровне                               |
| `POST /hp-notify`       | запланировать уведомление о восстановлении HP            |
| `DELETE /hp-notify`     | отменить запланированное HP-уведомление                  |
| `GET /arena/opponents`  | соперники для PvP, близкие по «опасности»                |
| `POST /arena/result`    | уведомить соперника об итоге боя                         |
| `GET /leaderboard`      | топ-10 по уровню/опыту (публичный, кэш 60 с)             |
| `GET /referrals`        | топ-10 рефереров (публичный)                             |
| `GET /admin?key=`       | список всех игроков (нужен `ADMIN_KEY`)                  |
| cron `*/10 * * * *`     | рассылка отложенных HP-уведомлений                       |

Все записывающие маршруты проверяют `initData` по алгоритму Telegram WebApp
(HMAC-SHA256), поэтому подделать чужое сохранение нельзя.

## Деплой через CLI (рекомендуется)

```bash
cd babylon/worker

# 1. Авторизация (один раз). Любой из вариантов:
npx wrangler login                       # интерактивный OAuth в браузере
# или экспортировать токен API:
export CLOUDFLARE_API_TOKEN=ваш_токен    # права: Workers Scripts:Edit, Workers KV:Edit

# 2. Создать KV-хранилище (один раз) и вписать выданный id в wrangler.toml
npx wrangler kv namespace create SAVES

# 3. Задать секреты (один раз)
npx wrangler secret put BOT_TOKEN        # токен бота из BotFather
npx wrangler secret put ADMIN_KEY        # произвольный пароль для /admin

# 4. Деплой (повторять при каждом обновлении save-worker.js)
npx wrangler deploy
```

После деплоя воркер доступен по адресу
`https://babylon-save.<субдомен>.workers.dev`. Этот адрес прописан в клиенте —
`babylon/js/state.js`, константа `CLOUD_URL`.

## Деплой через dashboard (без CLI)

1. Cloudflare → **Workers & Pages** → открыть воркер `babylon-save` → **Edit code**.
2. Вставить целиком содержимое `save-worker.js`, **Save and deploy**.
3. **Settings → Variables and Secrets**: добавить `BOT_TOKEN` (secret),
   `BOT_HANDLE` (text, `babylongame_bot`), `ADMIN_KEY` (secret).
4. **Settings → Bindings**: KV namespace, binding name `SAVES`.
5. **Settings → Triggers → Cron Triggers**: добавить `*/10 * * * *`.
