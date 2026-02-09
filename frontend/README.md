# Voice Bot Dashboard (SPA)

Дашборд для управления Discord Voice Channel Manager Bot: правила, whitelist/blacklist, расписания, логи.

## Стек

- React 18
- Vite 5
- React Router 6

## Настройка

1. Установить зависимости: `npm install`
2. Base URL API задаётся переменной окружения `VITE_API_BASE_URL` (по умолчанию `http://localhost:8000`) или в UI в разделе **Настройки** (сохраняется в `localStorage`).
3. **X-API-Key** вводится в разделе **Настройки** и сохраняется в `localStorage`; подставляется в заголовок для всех запросов к API.

## Запуск

- Разработка: `npm run dev` (приложение на http://localhost:5173)
- Сборка: `npm run build`
- Просмотр сборки: `npm run preview`

## Страницы

- **Дашборд** — активные правила, последние логи, счётчик в голосе (`GET /api/dashboard`).
- **Правила** — список, создание, редактирование, удаление, PATCH toggle (`/api/rules`).
- **Списки** — whitelist/blacklist: список по типу, добавление, удаление, массовое добавление (`/api/users`).
- **Расписания** — список, создание (rule_id, cron_expr, action, timezone), удаление (`/api/schedules`).
- **Логи** — список с пагинацией и фильтрами (discord_id, rule_id, action_type, date_from, date_to) (`/api/logs`).
- **Настройки** — Base URL API и X-API-Key (localStorage).

## WebSocket (опционально)

В шапке отображается индикатор **Live** / **Offline**. При наличии API key приложение пытается подключиться к `GET /api/ws/live`. Если эндпоинт не реализован на бэкенде, индикатор остаётся в состоянии Offline.
