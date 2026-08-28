# Tracked Members Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-managed list of Discord members whose individual voice activity, work-hours activity, and same-channel overlap can be posted to a configured text channel with `/tracking report`.

**Architecture:** Keep raw voice-session collection in `voice_sessions`. Add a focused `tracking_report` service for time-window clipping and overlap calculation, persistence for tracked-member schedules and the report-channel setting, API routes for the existing React dashboard, and an administrator-only Discord command that formats and posts the service result.

**Tech Stack:** Python 3, discord.py, FastAPI, asyncpg, SQLAlchemy/Alembic, PostgreSQL, React 18, Vite, MUI, pytest/pytest-asyncio, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-28-tracked-members-reporting-design.md`

## Global Constraints

- Do not change whitelist, blacklist, rule evaluation, mute levels, or existing pair-stacking behavior.
- Store Discord snowflakes as integers in Python/PostgreSQL and serialize them as strings in API JSON via `DiscordId`.
- Use UTC for persisted session timestamps; interpret each member's work schedule in its configured IANA timezone, defaulting to `Europe/Moscow`.
- Default tracking schedule is Monday-Friday, 09:00-18:00 MSK.
- Reports are sent only when an administrator runs `/tracking report`; no scheduled delivery is introduced.
- Do not add third-party dependencies.
- Commit each RED test checkpoint before its corresponding GREEN implementation checkpoint.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/engine/tracking_report.py` | Pure clipping, work-window, and same-channel overlap calculations; report DTOs. |
| `tests/test_engine/test_tracking_report.py` | Deterministic tests for individual and pair calculations. |
| `src/db/models.py` | SQLAlchemy models for tracked members and tracking settings. |
| `alembic/versions/006_tracking_reporting.py` | PostgreSQL schema migration. |
| `src/db/repositories/tracking_repo.py` | Persistence and report-query functions. |
| `src/api/schemas.py` | Request and response schemas for tracking configuration and preview. |
| `src/api/routers/tracking.py` | Authenticated CRUD, text-channel list, and preview endpoints. |
| `src/api/app.py` | Registers the tracking router. |
| `tests/test_api/test_tracking_api.py` | API authorization, validation, and CRUD/preview tests. |
| `src/bot/cogs/admin_commands.py` | `/tracking report` administrator command and Discord embed formatting. |
| `tests/test_bot/test_tracking_commands.py` | Command success and configuration-error tests. |
| `frontend/src/api/tracking.js` | Axios wrappers for tracking endpoints. |
| `frontend/src/pages/Tracking.jsx` | New management and preview page. |
| `frontend/src/App.jsx` | Adds `/tracking` route. |
| `frontend/src/components/Layout.jsx` | Adds navigation link. |
| `frontend/tests/tracking.spec.js` | Playwright end-to-end test with API route mocks. |

## Task 1: Pure tracking-report calculations

**Files:**
- Create: `src/engine/tracking_report.py`
- Test: `tests/test_engine/test_tracking_report.py`

**Interfaces:**
- Produces `Session(discord_id: int, channel_id: int, joined_at: datetime, left_at: datetime)`.
- Produces `MemberSchedule(work_days: set[int], work_start: time, work_end: time, timezone: str)` where Monday is `0`.
- Produces `calculate_member_totals(sessions, schedules, period_start, period_end) -> dict[int, MemberTotal]`.
- Produces `calculate_pair_overlaps(sessions, tracked_member_ids, period_start, period_end) -> list[PairOverlap]`.

- [ ] **Step 1: Write failing tests for clipping, MSK work time, and overlap.**

```python
@pytest.mark.parametrize(
    ("joined_at", "left_at", "expected"),
    [
        (dt("2026-08-03T08:30:00Z"), dt("2026-08-03T10:00:00Z"), 3600),
        (dt("2026-08-03T14:00:00Z"), dt("2026-08-03T19:00:00Z"), 14400),
    ],
)
def test_work_seconds_are_clipped_to_member_msk_window(joined_at, left_at, expected):
    schedule = MemberSchedule({0, 1, 2, 3, 4}, time(9), time(18), "Europe/Moscow")
    total = calculate_member_totals(
        [Session(1, 10, joined_at, left_at)], {1: schedule}, dt("2026-08-01T00:00:00Z"), dt("2026-08-10T00:00:00Z")
    )[1]
    assert total.work_seconds == expected

def test_pair_overlap_counts_only_same_channel_intersection():
    overlaps = calculate_pair_overlaps(
        [Session(1, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T10:00:00Z")),
         Session(2, 10, dt("2026-08-03T09:30:00Z"), dt("2026-08-03T10:30:00Z")),
         Session(3, 11, dt("2026-08-03T09:30:00Z"), dt("2026-08-03T10:30:00Z"))],
        {1, 2, 3}, dt("2026-08-03T00:00:00Z"), dt("2026-08-04T00:00:00Z"),
    )
    assert [(item.member_ids, item.channel_id, item.seconds) for item in overlaps] == [((1, 2), 10, 1800)]
```

- [ ] **Step 2: Run the focused test file and verify RED.**

Run: `pytest tests/test_engine/test_tracking_report.py -v`

Expected: FAIL because `src.engine.tracking_report` does not exist.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add tests/test_engine/test_tracking_report.py
git commit -m "test: define tracked reporting calculations"
```

- [ ] **Step 4: Implement only the calculation module.**

```python
def overlap_seconds(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> int:
    return max(0, int((min(a_end, b_end) - max(a_start, b_start)).total_seconds()))

def clip_session(session: Session, period_start: datetime, period_end: datetime) -> Session | None:
    start, end = max(session.joined_at, period_start), min(session.left_at, period_end)
    return Session(session.discord_id, session.channel_id, start, end) if start < end else None
```

Implement work-window clipping by iterating local calendar days inside the clipped session, converting each local window back to UTC, and summing intersections. Generate unordered member pairs with `itertools.combinations`; retain only sessions with matching `channel_id`.

- [ ] **Step 5: Run the focused test file and verify GREEN.**

Run: `pytest tests/test_engine/test_tracking_report.py -v`

Expected: PASS.

- [ ] **Step 6: Commit the GREEN implementation.**

```bash
git add src/engine/tracking_report.py tests/test_engine/test_tracking_report.py
git commit -m "feat: calculate tracked member activity"
```

## Task 2: Persistence and migration

**Files:**
- Modify: `src/db/models.py`
- Create: `alembic/versions/006_tracking_reporting.py`
- Create: `src/db/repositories/tracking_repo.py`
- Modify: `src/db/repositories/__init__.py`
- Modify: `tests/conftest.py`
- Test: `tests/test_engine/test_tracking_report.py`
- Create: `tests/test_db/test_tracking_repo.py`

**Interfaces:**
- Produces `list_tracked_members(pool) -> list[dict]`, `create_tracked_member(pool, payload) -> dict`, `update_tracked_member(pool, discord_id, payload) -> dict | None`, and `delete_tracked_member(pool, discord_id) -> bool`.
- Produces `get_tracking_settings(pool) -> dict` and `set_report_channel(pool, report_channel_id: int | None) -> dict`.
- Produces `load_report_sessions(pool, member_ids, period_start, period_end, now) -> list[Session]`.

- [ ] **Step 1: Write failing repository tests.**

```python
@pytest.mark.asyncio
async def test_create_tracked_member_applies_default_msk_schedule(pool):
    row = await tracking_repo.create_tracked_member(pool, {"discord_id": 42, "username": "Ada"})
    assert row["work_days"] == [0, 1, 2, 3, 4]
    assert row["work_start"] == "09:00:00"
    assert row["timezone"] == "Europe/Moscow"

@pytest.mark.asyncio
async def test_report_query_includes_open_session_clipped_at_now(pool):
    pool.voice_sessions = [{"discord_id": 42, "channel_id": 9, "joined_at": dt("2026-08-03T10:00:00Z"), "left_at": None}]
    sessions = await tracking_repo.load_report_sessions(pool, [42], dt("2026-08-03T00:00:00Z"), dt("2026-08-04T00:00:00Z"), dt("2026-08-03T12:00:00Z"))
    assert sessions == [Session(42, 9, dt("2026-08-03T10:00:00Z"), dt("2026-08-03T12:00:00Z"))]
```

- [ ] **Step 2: Run the repository test and verify RED.**

Run: `pytest tests/test_db/test_tracking_repo.py -v`

Expected: FAIL because `tracking_repo` and `MockPool` support are absent.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add tests/test_db/test_tracking_repo.py
git commit -m "test: define tracked member persistence"
```

- [ ] **Step 4: Add schema, migration, repository, and test-pool support.**

Create model fields exactly as in the approved spec. The Alembic migration creates `tracked_members` with a unique `discord_id`, `INTEGER[] work_days`, `TIME` start/end fields, `VARCHAR(50) timezone`, and timestamps; it creates singleton `tracking_settings` with nullable `BIGINT report_channel_id`. The downgrade drops `tracking_settings` before `tracked_members`.

The repository SQL must order members by `username, discord_id`, use `INSERT ... ON CONFLICT (discord_id) DO UPDATE` to retain a single configuration row, and query sessions using:

```sql
WHERE discord_id = ANY($1::bigint[])
  AND joined_at < $3
  AND COALESCE(left_at, $4) > $2
```

Extend `MockPool` only for these new query shapes, with isolated `tracked_members` and `tracking_settings` in-memory fields.

- [ ] **Step 5: Run repository and existing tracker tests.**

Run: `pytest tests/test_db/test_tracking_repo.py tests/test_engine/test_tracker.py -v`

Expected: PASS.

- [ ] **Step 6: Commit the GREEN implementation.**

```bash
git add src/db/models.py alembic/versions/006_tracking_reporting.py src/db/repositories/tracking_repo.py src/db/repositories/__init__.py tests/conftest.py tests/test_db/test_tracking_repo.py
git commit -m "feat: persist tracked member configuration"
```

## Task 3: Authenticated tracking API

**Files:**
- Modify: `src/api/schemas.py`
- Create: `src/api/routers/tracking.py`
- Modify: `src/api/routers/__init__.py`
- Modify: `src/api/app.py`
- Modify: `src/api/routers/guild.py`
- Create: `tests/test_api/test_tracking_api.py`

**Interfaces:**
- `GET /api/tracking/members`, `POST /api/tracking/members`, `PATCH /api/tracking/members/{discord_id}`, `DELETE /api/tracking/members/{discord_id}`.
- `GET/PATCH /api/tracking/settings`.
- `GET /api/tracking/text-channels` returns cached, sendable guild text channels as `{id, name}`.
- `GET /api/tracking/preview?period=today|week|month` returns personal totals and pair overlaps.

- [ ] **Step 1: Write failing endpoint tests.**

```python
@pytest.mark.asyncio
async def test_create_tracked_member_requires_auth(api_client):
    async with api_client as client:
        response = await client.post("/api/tracking/members", json={"discord_id": "42", "username": "Ada"})
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_preview_returns_personal_and_pair_sections(api_client, auth_cookie):
    async with api_client as client:
        response = await client.get("/api/tracking/preview?period=week", cookies=auth_cookie)
    assert response.status_code == 200
    assert set(response.json()) == {"period_start", "period_end", "members", "overlaps"}
```

- [ ] **Step 2: Run endpoint tests and verify RED.**

Run: `pytest tests/test_api/test_tracking_api.py -v`

Expected: FAIL with 404 because the tracking router is not registered.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add tests/test_api/test_tracking_api.py
git commit -m "test: define tracked member API"
```

- [ ] **Step 4: Implement schemas and routes.**

Use Pydantic validators to require `work_days` unique values from `0` through `6`, `HH:MM` times, and non-empty IANA timezone names. Reject a report channel that is not a cached `discord.TextChannel` or where the bot lacks `send_messages`. `preview` converts `today`, `week`, and `month` into MSK calendar boundaries, loads sessions from the repository, and passes them to Task 1's functions. Resolve current display names through `bot.get_guild(...).get_member` when available without turning a departed member into a 404.

- [ ] **Step 5: Run endpoint tests and the existing API suite.**

Run: `pytest tests/test_api/test_tracking_api.py tests/test_api/test_api_endpoints.py -v`

Expected: PASS.

- [ ] **Step 6: Commit the GREEN implementation.**

```bash
git add src/api/schemas.py src/api/routers/tracking.py src/api/routers/__init__.py src/api/app.py src/api/routers/guild.py tests/test_api/test_tracking_api.py
git commit -m "feat: expose tracking management API"
```

## Task 4: Discord report command

**Files:**
- Modify: `src/bot/cogs/admin_commands.py`
- Create: `tests/test_bot/test_tracking_commands.py`

**Interfaces:**
- Produces `TrackingGroup` with administrator-only `/tracking report`.
- Accepts `period: Literal["today", "week", "month"] = "today"`.
- Sends the report embed to the persisted `report_channel_id` and replies ephemerally to the invoker.

- [ ] **Step 1: Write failing command tests.**

```python
@pytest.mark.asyncio
async def test_tracking_report_posts_embed_to_configured_channel(mock_bot, interaction):
    await TrackingGroup(mock_bot).report.callback(TrackingGroup(mock_bot), interaction, "today")
    mock_bot.get_channel.return_value.send.assert_awaited_once()
    interaction.followup.send.assert_awaited_with("Отчёт отправлен в <#777>.", ephemeral=True)

@pytest.mark.asyncio
async def test_tracking_report_explains_missing_channel(mock_bot, interaction):
    mock_bot.pool.fetchrow.return_value = {"report_channel_id": None}
    await TrackingGroup(mock_bot).report.callback(TrackingGroup(mock_bot), interaction, "today")
    interaction.followup.send.assert_awaited_with("Сначала выберите канал отчётов в админке.", ephemeral=True)
```

- [ ] **Step 2: Run command tests and verify RED.**

Run: `pytest tests/test_bot/test_tracking_commands.py -v`

Expected: FAIL because `TrackingGroup` does not exist.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add tests/test_bot/test_tracking_commands.py
git commit -m "test: define tracking report command"
```

- [ ] **Step 4: Implement command and embed formatting.**

Follow the existing `RuleGroup` pattern: defer ephemerally, guard missing pool/configuration/channel, then send a `discord.Embed`. Include report period in the title; make one field per member with total, sessions, and work-hours time; add a `Стаки` field showing `member A + member B · #channel · duration`, or `Нет пересечений` when empty. Register the group in `setup()` beside existing groups.

- [ ] **Step 5: Run command and existing bot tests.**

Run: `pytest tests/test_bot/test_tracking_commands.py tests/test_bot/test_voice_manager.py -v`

Expected: PASS.

- [ ] **Step 6: Commit the GREEN implementation.**

```bash
git add src/bot/cogs/admin_commands.py tests/test_bot/test_tracking_commands.py
git commit -m "feat: publish tracked activity reports"
```

## Task 5: Admin page and browser verification

**Files:**
- Create: `frontend/src/api/tracking.js`
- Create: `frontend/src/pages/Tracking.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Layout.jsx`
- Create: `frontend/tests/tracking.spec.js`

**Interfaces:**
- `listTrackedMembers`, `createTrackedMember`, `updateTrackedMember`, `deleteTrackedMember`, `getTrackingSettings`, `setTrackingSettings`, `listTextChannels`, and `previewTrackingReport` in `frontend/src/api/tracking.js`.
- `/tracking` is a protected page route with a navigation item labelled `Отслеживание`.

- [ ] **Step 1: Write a failing Playwright test with mocked API responses.**

```javascript
test('adds a Discord member, edits schedule, and saves report channel', async ({ page }) => {
  await page.route('**/api/tracking/**', route => route.fulfill({ json: fixtureFor(route.request()) }))
  await page.goto('/tracking')
  await page.getByLabel('Пользователь').fill('Ada')
  await page.getByRole('option', { name: /Ada Lovelace/ }).click()
  await page.getByRole('button', { name: 'Добавить' }).click()
  await page.getByLabel('Начало рабочего дня').fill('10:00')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('Канал отчётов сохранён')).toBeVisible()
})
```

- [ ] **Step 2: Run the Playwright test and verify RED.**

Run: `cd frontend && npx playwright test tests/tracking.spec.js`

Expected: FAIL because `/tracking` is not registered.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add frontend/tests/tracking.spec.js
git commit -m "test: define tracking admin workflow"
```

- [ ] **Step 4: Implement the page using existing UI primitives.**

Use `PageHeader`, `MemberAutocomplete`, `MemberCell`, `LoadingState`, `ErrorState`, `EmptyState`, MUI `Drawer`, `Table`, `Select`, and snackbars as in the existing configuration pages. Preserve the established dark dashboard tokens; use clear hierarchy and compact data density rather than creating a new visual system. The report-channel selector gets options from `/api/tracking/text-channels`; the schedule drawer defaults to 09:00, 18:00, weekdays, and `Europe/Moscow`.

Add a compact preview block with a period selector and separate tables for personal totals and stacks. Use the APIs listed above; never expose or ask for a manual Discord ID.

- [ ] **Step 5: Run frontend checks and Playwright GREEN verification.**

Run: `cd frontend && npm run build && npx playwright test tests/tracking.spec.js`

Expected: build succeeds and Playwright passes.

- [ ] **Step 6: Commit the GREEN implementation.**

```bash
git add frontend/src/api/tracking.js frontend/src/pages/Tracking.jsx frontend/src/App.jsx frontend/src/components/Layout.jsx frontend/tests/tracking.spec.js
git commit -m "feat: add tracking admin page"
```

## Task 6: End-to-end verification and migration safety

**Files:**
- Modify only if verification exposes an implementation defect in tasks 1-5.

**Interfaces:**
- Confirms the application can migrate, run focused tests, build the dashboard, and report without changing unrelated behavior.

- [ ] **Step 1: Run the full backend suite.**

Run: `pytest -v`

Expected: PASS.

- [ ] **Step 2: Verify migration round-trip on a disposable PostgreSQL database.**

Run: `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`

Expected: all commands succeed; the final upgrade includes revision `006_tracking_reporting`.

- [ ] **Step 3: Build and verify the frontend.**

Run: `cd frontend && npm run build && npx playwright test tests/tracking.spec.js`

Expected: PASS.

- [ ] **Step 4: Inspect final Git state.**

Run: `git status --short && git log --oneline -8`

Expected: only intended tracking commits are present; do not commit `.env`, generated browser artifacts, or credentials.

- [ ] **Step 5: Commit any necessary verification-only fixes.**

```bash
git add <only-files-changed-by-fixes>
git commit -m "fix: complete tracking reporting verification"
```

## Plan Self-Review

- Spec coverage: Tasks 1-2 cover individual activity, work hours, active sessions, same-channel stacks, and persistence. Task 3 covers authenticated management, channel selection, and preview. Task 4 covers the administrator slash command and channel publication. Task 5 covers the bounded admin UI and Playwright workflow. Task 6 covers migration and integrated verification.
- Completeness scan: every task declares concrete outputs, error paths, and commands.
- Type consistency: all API and command flows consume Task 1 `Session`/calculation results and Task 2 repository functions; Discord IDs remain `int` internally and `DiscordId` at the API boundary.
