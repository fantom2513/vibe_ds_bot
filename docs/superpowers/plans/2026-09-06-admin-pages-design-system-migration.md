# Admin Pages Design-System Migration impl Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every existing administrative workflow to the approved Vibe design system without changing backend contracts or adding new product features.

**Architecture:** Treat the redesigned Dashboard as the visual reference and MUI as the behavior/accessibility layer. First extract only the repeated CRUD shells proven by the Rules page, then migrate related page groups while preserving their existing API functions and state flows. All page code consumes semantic tokens and shared UI recipes; raw color, legacy glow, emoji, and Discord-blurple styling stay out of production compositions.

**Tech Stack:** React 18, React Router 6, Vite 5, MUI 7, MUI X Data Grid 8, Recharts 3, Playwright, existing Axios API modules.

**Spec:** `docs/superpowers/specs/2026-09-05-vibe-product-redesign-design.md`

**Preceding phase:** `docs/superpowers/plans/2026-09-05-admin-dashboard-design-system.md`

## Scope

This plan covers the authenticated admin zone only:

- Rules;
- Users / whitelist / blacklist;
- Kick Targets;
- Stacking Pairs;
- Schedules;
- Tracking and its daily-work-hours chart;
- Logs;
- Settings;
- Mute Levels and leaderboard administration;
- navigation grouping required to expose the existing Mute Levels page.

It does not implement access-role derivation, guild-membership verification, the member portal, or the public landing page. Those remain independent later phases because they change authentication and backend authorization boundaries.

## Global Constraints

- Do not add dependencies or replace MUI.
- Do not change existing API routes or response schemas in this phase.
- Do not add new administrative capabilities; preserve current workflows and repair only defects that prevent those workflows from satisfying their existing API contracts.
- Do not use emoji, decorative Unicode pictographs, Discord blurple, purple, gradients, glass effects, or glow.
- Do not use raw colors in page components. Consume existing CSS semantic tokens, MUI palette roles, `StatusBadge`, and the tokenized chart palette introduced in Task 4.
- Keep Soft Mint for primary action/active state, Signal Sky for informational/live state, Attention Amber for warning/pending state, and Danger Rose only for error/destructive state.
- Keep Unbounded restricted to the product mark and major page titles. Forms, tabs, tables, dialogs, and buttons use IBM Plex Sans; IDs, cron expressions, timestamps, durations, and aligned numeric data use IBM Plex Mono.
- Use Russian user-facing labels consistently. Internal API values such as `whitelist`, `blacklist`, `mute`, `kick`, and `dry_run` may remain unchanged.
- One primary action per local context. Secondary and destructive hover styles must remain variant-scoped.
- Every icon-only action has an accessible name. Every drawer/dialog restores focus when closed.
- Prevent repeated mutations while save, toggle, or delete requests are pending. Escape/backdrop dismissal is blocked only during a pending destructive or save operation.
- Local validation errors appear beside the relevant field. Toasts confirm completed operations but are not the only error location.
- At 390 px, no page-level horizontal overflow is allowed. Wide data relationships may use a labelled responsive-row layout or controlled table-region scrolling.
- Preserve `prefers-reduced-motion` behavior and 44×44 px touch targets.
- Add Playwright behavior tests before production changes, verify RED, and commit the failing tests separately from the GREEN implementation.
- Do not add the pre-existing `.superpowers/` directory to any commit.

## File Structure

| File | Responsibility |
| --- | --- |
| `frontend/tests/admin-pages-redesign.spec.js` | Browser contract for all migrated admin workflows, pending states, keyboard use, responsiveness, and palette compliance. |
| `frontend/src/components/ui/FormDrawer.jsx` | Shared responsive create/edit drawer with form semantics and pending-state protection. |
| `frontend/src/components/ui/ConfirmDialog.jsx` | Shared destructive confirmation with explicit busy behavior. |
| `frontend/src/components/ui/index.js` | Public exports for the two new shared CRUD recipes. |
| `frontend/src/pages/Rules.jsx` | Reference implementation for dense tables, semantic statuses, fields, toggles, drawers, and destructive actions. |
| `frontend/src/pages/Users.jsx` | Whitelist/blacklist member management. |
| `frontend/src/pages/KickTargets.jsx` | Automatic voice-kick target management. |
| `frontend/src/pages/StackingPairs.jsx` | Pair-management workflow. |
| `frontend/src/pages/Schedules.jsx` | Cron schedule management. |
| `frontend/src/pages/Tracking.jsx` | Tracking configuration and report preview composition. |
| `frontend/src/components/DailyWorkHoursChart.jsx` | Tokenized operational chart rendering. |
| `frontend/src/styles/chartPalette.js` | Stable non-semantic categorical series colors for charts only. |
| `frontend/src/pages/Logs.jsx` | Localized responsive log filtering and data grid. |
| `frontend/src/pages/Settings.jsx` | Bot status, debug mode, and dashboard access settings. |
| `frontend/src/pages/Login.jsx` | Replaces the last use of the deprecated glow container with `Panel`. |
| `frontend/src/pages/MuteLevels.jsx` | Level configuration and leaderboard administration. |
| `frontend/src/main.jsx` | Registers the existing Mute Levels page at `/mute-levels`. |
| `frontend/src/components/AppLayout.jsx` | Groups Monitoring and Management navigation and adds Mute Levels. |

## Task 1: Establish CRUD recipes through the Rules page

- Create: `frontend/tests/admin-pages-redesign.spec.js`
- Create: `frontend/src/components/ui/FormDrawer.jsx`
- Create: `frontend/src/components/ui/ConfirmDialog.jsx`
- Modify: `frontend/src/components/ui/index.js`
- Modify: `frontend/src/pages/Rules.jsx`
- Consumes: `Panel`, `PageHeader`, `StatusBadge`, `ActionChip`, `LoadingState`, `ErrorState`, `EmptyState`, MUI theme button/toggle/input recipes.
- Produces: `FormDrawer` and `ConfirmDialog` props used by Tasks 2, 3, and 5; the Rules page becomes the reference CRUD composition.

### Required component interfaces

```jsx
<FormDrawer
  open={boolean}
  title={string}
  onClose={() => void}
  onSubmit={() => void | Promise<void>}
  submitting={boolean}
  submitLabel={string}
  width={number}
>
  {children}
</FormDrawer>

<ConfirmDialog
  open={boolean}
  title={string}
  description={ReactNode}
  confirmLabel={string}
  busy={boolean}
  onCancel={() => void}
  onConfirm={() => void | Promise<void>}
/>
```

- [ ] **Step 1: Add a Playwright harness with authenticated routing and realistic rule fixtures.**

Start Vite with the same `createRequire(process.argv[1])` pattern as `admin-dashboard-redesign.spec.js`. Mock `/auth/me` with an admin identity and use complete `RuleResponse` fixtures:

```javascript
const ruleFixture = {
  id: 7,
  name: 'Лимит времени',
  description: 'Ограничивает длительное пребывание в голосе',
  is_active: true,
  is_dry_run: false,
  target_list: 'blacklist',
  channel_ids: ['100'],
  max_time_sec: 3600,
  action_type: 'mute',
  action_params: {},
  schedule_cron: null,
  schedule_tz: 'Europe/Moscow',
  priority: 10,
  created_at: '2026-09-06T10:00:00Z',
  updated_at: '2026-09-06T10:00:00Z',
}
```

- [ ] **Step 2: Write failing Rules workflow tests.**

Test these behaviors independently:

```javascript
test('rules creates a named rule from labelled fields', async ({ page }) => {
  const state = await mockRules(page, [ruleFixture])
  await page.goto(`${BASE_URL}/rules`)
  await page.getByRole('button', { name: 'Создать правило' }).click()
  await page.getByLabel('Название').fill('Ночное ограничение')
  await page.getByLabel('Описание').fill('Ограничение для ночного канала')
  await page.getByLabel('Действие').click()
  await page.getByRole('option', { name: 'Заглушить' }).click()
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect.poll(() => state.createdPayload?.name).toBe('Ночное ограничение')
  expect(state.createdPayload.description).toBe('Ограничение для ночного канала')
})

test('rules keeps its drawer open and controls disabled while saving', async ({ page }) => {
  const saveGate = deferred()
  await mockRules(page, [ruleFixture], { saveGate })
  await page.goto(`${BASE_URL}/rules`)
  await page.getByRole('button', { name: 'Редактировать: Лимит времени' }).click()
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByRole('button', { name: 'Сохранение…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Редактировать правило' })).toBeVisible()
  saveGate.resolve()
})

test('rules protects a pending destructive confirmation', async ({ page }) => {
  const deleteGate = deferred()
  await mockRules(page, [ruleFixture], { deleteGate })
  await page.goto(`${BASE_URL}/rules`)
  await page.getByRole('button', { name: 'Удалить: Лимит времени' }).click()
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Удаление…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Удалить правило?' })).toBeVisible()
  deleteGate.resolve()
})
```

Also assert Russian page/table labels, semantic `StatusBadge` text for active/inactive and whitelist/blacklist, keyboard focus on the first drawer field, and no document overflow at 390×844.

- [ ] **Step 3: Run the Rules tests and verify RED.**

Run: `cd frontend && npx playwright test tests/admin-pages-redesign.spec.js -g "rules" --workers=1`

Expected: FAIL because the page lacks name/description fields, shared pending-state protection, accessible row-action names, and responsive behavior.

- [ ] **Step 4: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-pages-redesign.spec.js
git commit -m "test: define redesigned rules workflow"
```

- [ ] **Step 5: Implement `FormDrawer`.**

Use MUI `Drawer`, but render the inner region as a real form. `onSubmit` runs from both Enter and the submit button. Width is `min(100vw, width)`; the action bar remains reachable at the bottom. `onClose` is ignored while `submitting` is true. The submit button keeps its action label visible and adds a 16 px spinner during the busy state.

```jsx
<Box component="form" onSubmit={event => {
  event.preventDefault()
  if (!submitting) onSubmit()
}} sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
  <Box sx={{ p: 3, flex: 1 }}>{children}</Box>
  <Box sx={{ p: 2, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
    <Button variant="text" onClick={onClose} disabled={submitting}>Отмена</Button>
    <Button type="submit" variant="contained" disabled={submitting}>
      {submitting ? 'Сохранение…' : submitLabel}
    </Button>
  </Box>
</Box>
```

- [ ] **Step 6: Implement `ConfirmDialog`.**

Use `Dialog` with `aria-labelledby`/`aria-describedby`. The final confirm button uses the destructive contained recipe. While `busy`, disable both buttons, render `Удаление…`, and reject Escape/backdrop close. After successful deletion, the caller closes the dialog and returns focus to its row action.

- [ ] **Step 7: Recompose Rules using the shared recipes.**

Required changes:

- page title `Правила`, primary action `Создать правило`;
- include `name` and `description` in `defaultForm`, edit hydration, visible fields, and POST/PUT payload;
- convert channel IDs to numeric values before submission;
- use Russian visible labels for action and target-list values while preserving API values;
- associate invalid JSON and required action/name errors with their fields via `error` and `helperText`;
- use semantic badges instead of raw whitelist/blacklist colors;
- track `pendingRuleIds` so a rule toggle cannot fire twice;
- use labelled icon buttons `Редактировать: {name}` and `Удалить: {name}`;
- preserve `getRules`, `createRule`, `updateRule`, `toggleRule`, and `deleteRule` calls unchanged.

- [ ] **Step 8: Run Rules tests and build.**

Run: `cd frontend && npm run build && npx playwright test tests/admin-pages-redesign.spec.js -g "rules" --workers=1`

Expected: build and Rules tests PASS.

- [ ] **Step 9: Commit the GREEN implementation.**

```bash
git add frontend/src/components/ui/FormDrawer.jsx frontend/src/components/ui/ConfirmDialog.jsx frontend/src/components/ui/index.js frontend/src/pages/Rules.jsx
git commit -m "feat: migrate rules to Vibe design system"
```

## Task 2: Migrate member-management workflows

- Modify: `frontend/tests/admin-pages-redesign.spec.js`
- Modify: `frontend/src/pages/Users.jsx`
- Modify: `frontend/src/pages/KickTargets.jsx`
- Modify: `frontend/src/pages/StackingPairs.jsx`
- Consumes: `FormDrawer`, `ConfirmDialog`, `MemberAutocomplete`, `MemberCell`, `StatusBadge`, feedback components.
- Produces: consistent whitelist/blacklist, kick-target, and stacking-pair CRUD behavior.

- [ ] **Step 1: Add complete mocked API state for the three pages.**

Fixtures must mirror the existing responses:

```javascript
const listedUser = {
  discord_id: '42', list_type: 'whitelist', username: 'Ada',
  reason: null, created_at: '2026-09-06T10:00:00Z',
}
const kickTarget = {
  discord_id: '42', username: 'Ada', timeout_sec: 1800,
  max_timeout_sec: 3600, is_active: true,
}
const stackingPair = {
  id: 4, user_id_1: '42', user_id_2: '84',
  target_channel_id: '100', is_active: true,
  created_at: '2026-09-06T10:00:00Z',
}
```

Mock member search, single-member, and batch-member routes with complete `{id, username, display_name, label, avatar}` objects.

- [ ] **Step 2: Write failing behavior tests.**

Cover:

- `Участники` uses `Белый список` / `Чёрный список` tabs but submits `whitelist` / `blacklist`;
- adding a member exposes progress, prevents duplicate submit, and restores focus after close;
- deleting a member, kick target, or pair uses `ConfirmDialog` and cannot close while pending;
- kick-target editor shows minute-based user copy while preserving second-based API payloads;
- stacking-pair same-user validation is adjacent to the second member field and prevents POST;
- each switch is disabled during its own pending request;
- each page remains within the 390 px viewport.

```javascript
test('stacking pairs prevents choosing the same member twice', async ({ page }) => {
  const state = await mockMemberManagement(page)
  await page.goto(`${BASE_URL}/stacking-pairs`)
  await page.getByRole('button', { name: 'Добавить пару' }).click()
  await selectMember(page, 'Первый участник', 'Ada')
  await selectMember(page, 'Второй участник', 'Ada')
  await expect(page.getByText('Выберите двух разных участников')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
  expect(state.createdPairPayload).toBeNull()
})
```

- [ ] **Step 3: Run the member-management tests and verify RED.**

Run: `cd frontend && npx playwright test tests/admin-pages-redesign.spec.js -g "users|kick targets|stacking pairs" --workers=1`

Expected: FAIL on legacy labels, duplicated dialogs/drawers, missing pending guards, and mobile overflow.

- [ ] **Step 4: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-pages-redesign.spec.js
git commit -m "test: define member management migration"
```

- [ ] **Step 5: Migrate Users.**

Use sentence-case Russian copy and semantic tab labels. Keep `list_type` internal. Replace both local dialogs with the shared recipes: a narrow `FormDrawer` for adding and `ConfirmDialog` for removal. Empty states say what can be added and expose one relevant primary action. Keep member ID in IBM Plex Mono through `MemberCell`; do not show manual ID fields.

- [ ] **Step 6: Migrate KickTargets.**

Use `Кик-цели`, `Минимальное время`, `Максимальное время`, and explicit `Включено` status text. Keep seconds in the API but present minutes in form fields and convert with `minutes * 60`. Validate positive minimum and `maximum >= minimum` beside the fields. Track per-target toggle state.

- [ ] **Step 7: Migrate StackingPairs.**

Use `Первый участник`, `Второй участник`, and `Целевой голосовой канал`. Keep the current channel-ID input because this phase adds no new channel-list API. Apply `error`/`helperText` to the second autocomplete for duplicate members. Use a compact two-person row composition on mobile.

- [ ] **Step 8: Run tests and build.**

Run: `cd frontend && npm run build && npx playwright test tests/admin-pages-redesign.spec.js -g "users|kick targets|stacking pairs" --workers=1`

Expected: PASS.

- [ ] **Step 9: Commit the GREEN implementation.**

```bash
git add frontend/src/pages/Users.jsx frontend/src/pages/KickTargets.jsx frontend/src/pages/StackingPairs.jsx
git commit -m "feat: migrate member management pages"
```

## Task 3: Migrate schedule management

- Modify: `frontend/tests/admin-pages-redesign.spec.js`
- Modify: `frontend/src/pages/Schedules.jsx`
- Consumes: `FormDrawer`, `ConfirmDialog`, `StatusBadge`, existing schedules/rules API modules.
- Produces: responsive schedule creation/editing with local cron guidance and protected mutation states.

- [ ] **Step 1: Add schedule and related-rule fixtures.**

```javascript
const scheduleFixture = {
  id: 3,
  rule_id: 7,
  cron_expr: '0 22 * * 1-5',
  timezone: 'Europe/Moscow',
  action: 'enable',
  is_active: true,
  created_at: '2026-09-06T10:00:00Z',
  updated_at: '2026-09-06T10:00:00Z',
}
```

- [ ] **Step 2: Write failing schedule tests.**

Test that the page:

- uses Russian labels and resolves the related rule name;
- shows cron code in mono plus a plain-language preview;
- renders action/status through semantic badges rather than raw colors;
- reports invalid cron beside the cron field;
- disables drawer close and submit while saving;
- protects pending deletion;
- collapses secondary columns on 390 px without document overflow.

- [ ] **Step 3: Run tests and verify RED.**

Run: `cd frontend && npx playwright test tests/admin-pages-redesign.spec.js -g "schedules" --workers=1`

Expected: FAIL on legacy composition and interaction-state behavior.

- [ ] **Step 4: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-pages-redesign.spec.js
git commit -m "test: define schedule page migration"
```

- [ ] **Step 5: Recompose Schedules.**

Use shared drawer/dialog components, semantic badges, Russian labels, and the existing `cronDescription` function. Keep the existing API payload exactly `{rule_id, cron_expr, timezone, action, is_active}`. Show request errors inside the drawer. Add `pendingScheduleIds` for row actions and keep the page-level empty state actionable.

- [ ] **Step 6: Run tests and build.**

Run: `cd frontend && npm run build && npx playwright test tests/admin-pages-redesign.spec.js -g "schedules" --workers=1`

Expected: PASS.

- [ ] **Step 7: Commit the GREEN implementation.**

```bash
git add frontend/src/pages/Schedules.jsx
git commit -m "feat: migrate schedule management page"
```

## Task 4: Migrate Tracking and tokenize its chart

- Modify: `frontend/tests/admin-pages-redesign.spec.js`
- Create: `frontend/src/styles/chartPalette.js`
- Modify: `frontend/src/components/DailyWorkHoursChart.jsx`
- Modify: `frontend/src/pages/Tracking.jsx`
- Consumes: existing tracking API module and the proven behaviors in `frontend/tests/tracking.spec.js`.
- Produces: tokenized operational chart and responsive tracking composition without changing reporting logic.

- [ ] **Step 1: Extend tests with visual-contract and responsive assertions.**

Reuse the complete tracking fixtures and route mocks from `tracking.spec.js`. Add assertions for:

- page title and section copy in Russian;
- report-channel save, member add, schedule edit, delete, preview period, and chart refresh behavior still available;
- `Panel` boundaries around configuration, tracked members, preview, and chart rather than arbitrary nested cards;
- chart tooltip, grid, axes, and legend consume approved token values;
- no chart series uses Discord blurple or decorative purple;
- stacked configuration and preview remain usable at 390 px.

```javascript
test('tracking chart uses the dedicated non-semantic series palette', async ({ page }) => {
  await mockTracking(page, { daily: dailyWorkHoursFixture })
  await page.goto(`${BASE_URL}/tracking`)
  const fills = await page.locator('.recharts-bar-rectangle path').evaluateAll(paths =>
    [...new Set(paths.map(path => getComputedStyle(path).fill))]
  )
  expect(fills).not.toContain('rgb(88, 101, 242)')
  expect(fills.length).toBeGreaterThan(1)
})
```

- [ ] **Step 2: Run Tracking tests and verify RED.**

Run: `cd frontend && npx playwright test tests/admin-pages-redesign.spec.js -g "tracking" --workers=1`

Expected: FAIL because the chart and page still contain raw legacy colors and mixed container recipes.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-pages-redesign.spec.js
git commit -m "test: define tracking visual migration"
```

- [ ] **Step 4: Add a chart-only categorical palette.**

Export a stable array from `chartPalette.js`. These values distinguish people inside charts and do not redefine semantic status colors:

```javascript
export const chartSeriesColors = [
  '#65C69C', '#67B9DE', '#DDB868', '#E58A94',
  '#8FC8B1', '#82AFC7', '#C8A985', '#A8B5B0',
]
```

The series assignment remains stable by member order, matching current behavior. Do not reuse these values for buttons, badges, alerts, or statuses.

- [ ] **Step 5: Refactor DailyWorkHoursChart.**

Import `chartSeriesColors`. Use CSS variables for grid, axis, tooltip background, border, and text. Keep `formatHours`, `formatDateShort`, grouped bars, stable member keys, and the conditional legend unchanged. Reduce chart height on mobile and keep the chart inside its own horizontally bounded region.

- [ ] **Step 6: Recompose Tracking without changing data flow.**

Retain all current API calls, race protection, selected-period behavior, and mutations covered by `tracking.spec.js`. Replace one-off headings/containers/raw colors with `PageHeader`, `Panel`, `StatusBadge`, and shared dialogs/drawers where their behavior matches. Do not split the 600-line page merely for aesthetics; extract only a section whose interface is independently testable and reduces actual duplication.

- [ ] **Step 7: Run both Tracking suites and build.**

Run: `cd frontend && npm run build && npx playwright test tests/tracking.spec.js tests/admin-pages-redesign.spec.js -g "tracking|reports|schedule|channel" --workers=1`

Expected: existing workflow tests and new visual-contract tests PASS.

- [ ] **Step 8: Commit the GREEN implementation.**

```bash
git add frontend/src/styles/chartPalette.js frontend/src/components/DailyWorkHoursChart.jsx frontend/src/pages/Tracking.jsx
git commit -m "feat: migrate tracking workspace"
```

## Task 5: Migrate Logs and Settings and retire glow usage

- Modify: `frontend/tests/admin-pages-redesign.spec.js`
- Modify: `frontend/src/pages/Logs.jsx`
- Modify: `frontend/src/pages/Settings.jsx`
- Modify: `frontend/src/pages/Login.jsx`
- Consumes: `Panel`, `StatusBadge`, theme tokens, existing logs/stats/debug APIs.
- Produces: localized monitoring/settings screens and zero production callers of `GlowCard`.

- [ ] **Step 1: Add logs/settings API fixtures and failing tests.**

For Logs, verify:

- Russian field labels and grid text (`Нет событий`, `Строк на странице`);
- Apply and Reset submit the visible filter state;
- CSV export preserves active filters;
- date inputs have persistent labels;
- grid is contained at 390 px and important columns remain reachable.

For Settings, verify:

- `Настройки`, `Состояние бота`, `Режим отладки`, and `Доступ к панели` copy;
- bot state is text plus icon and semantic tone;
- the debug switch is disabled while PATCH is pending and reverts on failure;
- access rows use `StatusBadge` and mono IDs;
- the page and Login contain no legacy glow/shadow treatment.

```javascript
test('settings reverts debug mode when saving fails', async ({ page }) => {
  await mockSettings(page, { debugMode: false, patchStatus: 500 })
  await page.goto(`${BASE_URL}/settings`)
  const toggle = page.getByRole('checkbox', { name: 'Режим отладки' })
  await toggle.check()
  await expect(page.getByRole('alert')).toContainText('Не удалось изменить режим отладки')
  await expect(toggle).not.toBeChecked()
})
```

- [ ] **Step 2: Run monitoring/settings tests and verify RED.**

Run: `cd frontend && npx playwright test tests/admin-pages-redesign.spec.js -g "logs|settings|login panel" --workers=1`

Expected: FAIL on English copy, raw DataGrid styling, unprotected debug mutation, and remaining `GlowCard` callers.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-pages-redesign.spec.js
git commit -m "test: define logs and settings migration"
```

- [ ] **Step 4: Migrate Logs.**

Wrap filters in a compact semantic toolbar region, use responsive widths, and map MUI X locale text directly:

```javascript
const gridLocale = {
  noRowsLabel: 'Нет событий',
  footerRowSelected: count => `Выбрано: ${count}`,
  MuiTablePagination: { labelRowsPerPage: 'Строк на странице:' },
}
```

Remove page-local raw grid colors; apply shared theme and semantic variables. Keep the existing query/filter/export API behavior.

- [ ] **Step 5: Migrate Settings.**

Replace both `GlowCard` regions with `Panel`. Represent Online and Allowed through `StatusBadge`. Track `debugSaving`; disable the switch while pending; only commit `debugMode` after a successful response, and restore the prior state on failure. Keep failures local to the debug panel plus an alert/toast announcement.

- [ ] **Step 6: Remove Login's production dependency on GlowCard.**

Use `Panel` as the login boundary with the same 360 px content width. Do not delete `GlowCard.jsx` or `ActionTag.jsx` in this phase because project rules forbid deleting files without explicit authorization; leave them unused and remove `GlowCard` from the public UI barrel only if no production import remains.

- [ ] **Step 7: Run tests and build.**

Run: `cd frontend && npm run build && npx playwright test tests/admin-pages-redesign.spec.js -g "logs|settings|login panel" --workers=1`

Expected: PASS.

- [ ] **Step 8: Commit the GREEN implementation.**

```bash
git add frontend/src/pages/Logs.jsx frontend/src/pages/Settings.jsx frontend/src/pages/Login.jsx frontend/src/components/ui/index.js
git commit -m "feat: migrate logs and settings pages"
```

## Task 6: Restore and migrate Mute Levels, then group admin navigation

- Modify: `frontend/tests/admin-pages-redesign.spec.js`
- Modify: `frontend/src/pages/MuteLevels.jsx`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/components/AppLayout.jsx`
- Consumes: existing mute-level/leaderboard/role APIs, shared CRUD recipes, grouped navigation shell.
- Produces: reachable level administration and explicit Monitoring/Management navigation groups.

- [ ] **Step 1: Add complete level, leaderboard, and guild-role fixtures.**

```javascript
const levelFixture = {
  level: 2,
  name: 'Тишина II',
  required_xp: 500,
  role_id: '900',
  is_active: true,
}
const leaderboardFixture = {
  discord_id: '42', username: 'Ada', xp: 620,
  level: 2, total_mute_seconds: 7200,
}
const roleFixture = { id: '900', name: 'Тихий', color: 6743708 }
```

- [ ] **Step 2: Write failing route, navigation, and workflow tests.**

Assert:

- `/mute-levels` renders under the protected admin shell;
- expanded navigation contains labelled `Мониторинг` and `Управление` groups plus `Уровни`;
- collapsed navigation retains accessible link names without rendering group labels;
- create/edit validates level, name, XP threshold, and role beside fields;
- role color is shown only as role metadata, not reused as interface chrome;
- delete is protected while pending;
- leaderboard rank uses text/position and not gold/silver/bronze raw color alone;
- 390 px layout has no document overflow.

- [ ] **Step 3: Run Mute Levels/navigation tests and verify RED.**

Run: `cd frontend && npx playwright test tests/admin-pages-redesign.spec.js -g "mute levels|navigation groups" --workers=1`

Expected: FAIL because the route/nav item is absent and the page retains purple/raw status styling and duplicated CRUD shells.

- [ ] **Step 4: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-pages-redesign.spec.js
git commit -m "test: define mute level admin migration"
```

- [ ] **Step 5: Migrate MuteLevels.**

Use page title `Уровни тишины`, sections `Настройка уровней` and `Рейтинг участников`, semantic badges for active state, and shared drawer/dialog components. Keep guild role swatches local to the role selector. Render ranking as a mono ordinal (`1`, `2`, `3`) with an accessible `Место N` label; do not introduce trophy symbols or emoji.

- [ ] **Step 6: Register the route.**

Import `MuteLevels` in `frontend/src/main.jsx` and add:

```jsx
<Route path="/mute-levels" element={<MuteLevels />} />
```

- [ ] **Step 7: Group admin navigation.**

Replace the flat `navItems` array with:

```javascript
const navGroups = [
  {
    label: 'Мониторинг',
    items: [
      { path: '/', label: 'Обзор', Icon: DashboardOutlined },
      { path: '/tracking', label: 'Отслеживание', Icon: QueryStatsOutlined },
      { path: '/logs', label: 'Журнал', Icon: ArticleOutlined },
    ],
  },
  {
    label: 'Управление',
    items: [
      { path: '/rules', label: 'Правила', Icon: ListAltOutlined },
      { path: '/schedules', label: 'Расписания', Icon: AccessTimeOutlined },
      { path: '/users', label: 'Участники', Icon: GroupOutlined },
      { path: '/kick-targets', label: 'Кик-цели', Icon: FlashOnOutlined },
      { path: '/stacking-pairs', label: 'Стаки', Icon: PeopleOutlined },
      { path: '/mute-levels', label: 'Уровни', Icon: MilitaryTechOutlined },
      { path: '/settings', label: 'Настройки', Icon: SettingsOutlined },
    ],
  },
]
```

Group labels are quiet sentence-case text, not tracked uppercase eyebrows. Hide them in collapsed mode while retaining accessible link names and tooltips.

- [ ] **Step 8: Run tests and build.**

Run: `cd frontend && npm run build && npx playwright test tests/admin-pages-redesign.spec.js -g "mute levels|navigation groups" --workers=1`

Expected: PASS.

- [ ] **Step 9: Commit the GREEN implementation.**

```bash
git add frontend/src/pages/MuteLevels.jsx frontend/src/main.jsx frontend/src/components/AppLayout.jsx
git commit -m "feat: migrate mute levels and group navigation"
```

## Task 7: Full admin regression and design-system compliance

- Modify: `frontend/tests/admin-pages-redesign.spec.js`
- Modify only if a demonstrated defect requires it: files changed in Tasks 1–6.
- Consumes: all migrated admin pages and Phase 1 browser suites.
- Produces: a verified admin zone ready for the access-role/member-portal phase.

- [ ] **Step 1: Add a route matrix test.**

Visit every protected route with appropriate mocked API responses:

```javascript
const adminRoutes = [
  '/', '/rules', '/users', '/kick-targets', '/stacking-pairs',
  '/tracking', '/schedules', '/logs', '/settings', '/mute-levels',
]
```

For each route, assert one visible `h1`/major heading, no unexpected horizontal overflow at 390 px, no emoji/pictographic text, and no computed color matching legacy Discord blurple `rgb(88, 101, 242)` or purple `rgb(139, 92, 246)`.

- [ ] **Step 2: Add keyboard and mutation-state coverage.**

For one representative drawer, dialog, tab set, switch, filter toolbar, and DataGrid:

- reach the control by keyboard;
- confirm visible focus;
- confirm Escape behavior;
- confirm pending mutations cannot repeat;
- confirm focus restoration after close.

- [ ] **Step 3: Run the new compliance tests and verify RED if gaps remain.**

Run: `cd frontend && npx playwright test tests/admin-pages-redesign.spec.js -g "route matrix|keyboard matrix" --workers=1`

Expected: any remaining page-specific legacy styling or accessibility gap is exposed before the final verification commit.

- [ ] **Step 4: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-pages-redesign.spec.js
git commit -m "test: cover complete admin design migration"
```

- [ ] **Step 5: Fix only defects demonstrated by Task 7 tests.**

Prefer shared recipe/theme fixes when multiple routes fail the same assertion. Use page-local fixes only for page-specific behavior. Do not begin access-role, member-portal, landing-page, backend, or bundle-splitting work here.

- [ ] **Step 6: Run all frontend verification.**

Run: `cd frontend && npm run build && npx playwright test tests/admin-dashboard-redesign.spec.js tests/admin-pages-redesign.spec.js tests/tracking.spec.js --workers=1`

Expected: production build succeeds and all browser tests PASS.

- [ ] **Step 7: Run static compliance scans.**

Run: `rg -n "#5865F2|#8b5cf6|rgba\(88,\s*101,\s*242|rgba\(139,\s*92,\s*246|[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" frontend/src/pages frontend/src/components`

Expected: no production UI match. Role colors returned by Discord may remain data-driven inside the Mute Levels role selector; the source code contains no fixed Discord role colors.

- [ ] **Step 8: Inspect the final change set.**

Run: `git diff --check && git status --short && git log --oneline -20`

Expected: no whitespace errors; only intended plan/tests/frontend changes plus the user's pre-existing untracked `.superpowers/` directory.

- [ ] **Step 9: Commit any final GREEN fixes.**

```bash
git add frontend/tests/admin-pages-redesign.spec.js frontend/src
git commit -m "fix: complete admin design system migration"
```

## Follow-on Phases

After this plan is implemented and visually accepted:

1. **Phase 3 — access model:** Discord authentication for all users, server-side guild membership, explicit `guest/member/admin/outsider` roles, route authorization, safe return paths, and restricted-access state.
2. **Phase 4 — member portal:** personal level and XP progress, mute statistics, own session history, leaderboard, and explanation of XP rules.
3. **Phase 5 — public landing:** single-community landing page, representative non-personal preview, OAuth entry, privacy/status copy, and cancellation/error recovery.

Each phase receives its own implementation plan because Phase 3 changes security boundaries, Phase 4 adds personal data APIs, and Phase 5 introduces a public surface.

## Plan Self-Review

- Spec coverage: every existing admin page is assigned to Tasks 1–6; Task 7 verifies the complete route set. Access roles, member portal, and landing page are explicitly deferred to independent plans.
- Existing-data fit: every page retains its current frontend API module and backend route. Rules adds missing `name`/`description` fields because the existing backend `RuleCreate` contract already requires them; this repairs an existing broken workflow rather than adding a feature.
- Component boundaries: only two repeated CRUD compositions are extracted. Tables, filters, and page sections remain page-specific unless an existing shared primitive already covers them.
- State completeness: loading, empty, local error, toast confirmation, save, toggle, delete, retry, keyboard focus, Escape, mobile, and reduced-motion requirements have concrete tests.
- Visual consistency: pages consume semantic tokens and approved shared recipes. Chart series use an explicitly non-semantic, chart-only palette and never leak into product status or action colors.
- Type consistency: `FormDrawer` and `ConfirmDialog` interfaces are defined once in Task 1 and consumed unchanged by later tasks. Existing API payload names remain unchanged.
- Deletion safety: deprecated `GlowCard.jsx` and unused `ActionTag.jsx` are not deleted without explicit user authorization; Phase 2 only removes production callers.
- TDD compliance: every independently reviewable page group begins with focused failing browser tests, commits RED separately, implements minimally, verifies GREEN, and commits implementation separately.
