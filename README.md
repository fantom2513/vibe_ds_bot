# Discord Voice Bot (MVP)

Бот для Discord: мониторинг голосовых каналов, правила, кик по таймауту, pair stacking, дашборд и API.

---

## Быстрый старт (Docker)

1. **Скопируйте конфиг и заполните переменные:**
   ```bash
   copy .env.example .env
   ```
   В `.env` обязательно укажите:
   - `DISCORD_TOKEN` — токен бота из [Discord Developer Portal](https://discord.com/developers/applications)
   - `DISCORD_GUILD_ID` — ID вашего сервера (включите режим разработчика в Discord: Настройки → Расширенные → Режим разработчика)
   - `API_SECRET_KEY` — любой длинный случайный ключ для JWT (дашборд/API)

2. **Запуск:**
   ```bash
   docker-compose up -d
   ```
   Поднимется PostgreSQL и бот. Миграции БД выполняются автоматически при старте контейнера.

3. **Проверка:**
   - Бот должен появиться на сервере (Online).
   - API: `http://localhost:8000` (документация: `http://localhost:8000/docs`).

4. **Остановка:**
   ```bash
   docker-compose down
   ```

---

## Локальный запуск (без Docker бота)

Удобно для разработки: БД в Docker, бот и API — локально.

1. **Запустите только PostgreSQL:**
   ```bash
   docker-compose up -d db
   ```

2. **Создайте виртуальное окружение и установите зависимости:**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   # source .venv/bin/activate  # Linux/macOS
   pip install -r requirements.txt
   ```

3. **Файл `.env`** — для локального запуска укажите подключение к локальной БД:
   ```env
   DATABASE_URL=postgresql+asyncpg://bot:password@localhost:5432/voice_bot
   ```
   Остальные переменные — как в `.env.example`.

4. **Миграции (один раз или после изменений схемы):**
   ```bash
   alembic upgrade head
   ```

5. **Запуск бота и API:**
   ```bash
   python -m src.main
   ```

---

## Хостинг (VPS / облако)

Подойдёт любой сервер с Docker (Linux): VPS (Hetzner, DigitalOcean, Timeweb и т.п.), облако (Yandex Cloud, Selectel).

### Шаги

1. **Сервер:** Ubuntu 22.04 (или аналог). Установите Docker и Docker Compose:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-plugin
   sudo usermod -aG docker $USER
   # выйти и зайти снова в SSH
   ```

2. **Клонируйте проект на сервер** (или залейте файлы через git/scp):
   ```bash
   git clone <ваш-репозиторий> mvp_ds_bot && cd mvp_ds_bot
   ```

3. **Создайте `.env` на сервере** (как в «Быстрый старт»). Для одного сервера оставьте:
   - `DATABASE_URL=postgresql+asyncpg://bot:password@db:5432/voice_bot` (для docker-compose)
   - На проде смените `POSTGRES_PASSWORD` в `docker-compose.yml` и в `DATABASE_URL`.

4. **Запуск:**
   ```bash
   docker compose up -d --build
   ```

5. **Логи и перезапуск:**
   ```bash
   docker compose logs -f bot
   docker compose restart bot
   ```

### Важно для продакшена

- **Секреты:** сильный `API_SECRET_KEY`, надёжный пароль PostgreSQL в `docker-compose.yml` и в `DATABASE_URL`.
- **Файрвол:** откройте только нужные порты (например, 22 для SSH). API (8000) можно не открывать наружу, если дашбордом пользуетесь только вы через SSH-туннель.
- **Обновления:** после `git pull` пересоберите и перезапустите:
  ```bash
  docker compose up -d --build
  ```

---

## Переменные окружения (.env)

| Переменная | Описание |
|------------|----------|
| `DISCORD_TOKEN` | Токен бота (Discord Developer Portal) |
| `DISCORD_GUILD_ID` | ID сервера Discord |
| `DATABASE_URL` | Подключение к PostgreSQL (`postgresql+asyncpg://user:pass@host:port/db`) |
| `API_HOST` | Хост API (по умолчанию `0.0.0.0`) |
| `API_PORT` | Порт API (по умолчанию `8000`) |
| `API_SECRET_KEY` | Секрет для JWT (дашборд/API) |
| `SCHEDULER_CHECK_INTERVAL` | Интервал проверки планировщика в секундах |
| `DEFAULT_TIMEZONE` | Часовой пояс (например `Europe/Moscow`) |
| `RATE_LIMIT_ACTIONS_PER_MINUTE` | Лимит действий в минуту |

---

## Конфиг бота (config.yaml)

- `bot.command_prefix` — префикс команд (по умолчанию `!`).
- `channels.monitored` — список ID голосовых каналов для мониторинга.
- `pair_stacking`, `kick_timeout` и др. — настраиваются также через дашборд (API).

При монтировании в Docker конфиг берётся с хоста: `./config.yaml:/app/config.yaml`.

---

## Дашборд и API

- **API:** после запуска доступен на `http://localhost:8000` (или ваш хост/порт).
- **Документация:** `http://localhost:8000/docs`.
- **Фронтенд-дашборд** в папке `frontend/` — отдельный проект (Vite/React), подключается к этому API; запуск см. в `frontend/README.md`.

Если нужна помощь с настройкой Discord-приложения (Intents, OAuth2, права бота) — напишите, опишу по шагам.
