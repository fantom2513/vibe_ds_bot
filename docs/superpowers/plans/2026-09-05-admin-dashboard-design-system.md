# Admin Dashboard Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first redesign vertical slice: a reusable visual foundation, responsive admin shell, and production Dashboard built from the approved graphite and Soft Mint design language.

**Architecture:** Keep MUI as the accessible component engine and add a thin product-specific design-system layer above it. Define primitive, semantic, and component tokens centrally, apply them through the existing MUI theme, then validate the system in a real screen rather than building an isolated component museum. Reuse the existing `/api/dashboard`, `/api/stats/overview`, and SSE contracts; this phase requires no backend changes.

**Tech Stack:** React 18, Vite 5, MUI 7, Emotion, Framer Motion, Playwright, existing FastAPI dashboard API.

**Spec:** `docs/superpowers/specs/2026-09-05-vibe-product-redesign-design.md`

## Scope of This Plan

This is Phase 1 of the approved product redesign. It covers:

- graphite neutral surfaces and Soft Mint primary actions;
- Signal Sky, Attention Amber, and Danger Rose semantic states;
- Unbounded headings, IBM Plex Sans interface copy, and IBM Plex Mono technical values;
- primary, secondary, destructive, focus, loading, disabled, empty, and error states needed by the shell and Dashboard;
- collapsible desktop navigation and mobile drawer behavior;
- Dashboard sections for general status, people in voice, recent activity, and active rules.

It deliberately does not redesign every admin page, build the member portal, or build the public landing page. Those become separate plans after this slice proves the system in the real interface.

## Global Constraints

- Do not add a new component library or new dependency. MUI remains the behavior/accessibility foundation.
- Do not introduce Discord blurple, decorative purple, gradients, neon glows, glass blur, or emoji as interface icons.
- Use color semantically; most layout and hierarchy stay neutral.
- Keep the existing auth, routing, dashboard fetch, and SSE behavior intact.
- Use the actual entry point `frontend/src/main.jsx`; do not migrate routes through the stale `frontend/src/App.jsx` in this phase.
- All interactive controls need visible hover, pressed, keyboard focus, loading, and disabled behavior.
- Primary hover is intentionally modest: lighter mint, slightly brighter border, and a 1 px lift. Secondary styling must not change when primary hover is adjusted.
- Respect `prefers-reduced-motion` and maintain a 44 px minimum touch target on mobile.
- Commit every RED browser-test checkpoint separately from its GREEN implementation checkpoint.

## File Structure

| File | Responsibility |
| --- | --- |
| `frontend/tests/admin-dashboard-redesign.spec.js` | Browser contract for tokens, shell, dashboard content, states, responsiveness, and keyboard access. |
| `frontend/src/styles/tokens.css` | Primitive, semantic, and component CSS variables. |
| `frontend/src/styles/typography.css` | Approved font imports and typography utility declarations. |
| `frontend/src/styles/global.css` | Canvas, reset, focus, scrolling, and reduced-motion behavior. |
| `frontend/src/styles/theme.js` | MUI mapping for colors, typography, density, and component interaction states. |
| `frontend/src/styles/motion.jsx` | Restrained page/card motion with reduced-motion fallback. |
| `frontend/src/components/BrandMark.jsx` | Text-and-shape Vibe identity without emoji or Discord imitation. |
| `frontend/src/components/AppLayout.jsx` | Responsive admin navigation shell. |
| `frontend/src/components/ui/Panel.jsx` | Neutral content container with optional heading/action region. |
| `frontend/src/components/ui/StatusBadge.jsx` | Compact semantic status indicator. |
| `frontend/src/components/ui/PageHeader.jsx` | Responsive page title, context, and action layout. |
| `frontend/src/components/ui/StatCard.jsx` | Compact metric block using semantic tone names rather than raw colors. |
| `frontend/src/components/ui/EmptyState.jsx` | Quiet, icon-component-based empty state. |
| `frontend/src/components/ui/LoadingState.jsx` | Accessible loading state with status text. |
| `frontend/src/components/ui/ErrorState.jsx` | Error state with optional retry action. |
| `frontend/src/components/ui/ActionChip.jsx` | Semantic action labels aligned with the new palette. |
| `frontend/src/components/ui/index.js` | Public exports for the product UI layer. |
| `frontend/src/pages/Dashboard.jsx` | Real command-center composition using the new system. |

## Task 1: Lock the design-token and typography contract

**Files:**

- Create: `frontend/tests/admin-dashboard-redesign.spec.js`
- Modify: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/styles/typography.css`
- Modify: `frontend/src/styles/global.css`
- Modify: `frontend/src/styles/theme.js`

- [ ] **Step 1: Add a shared browser fixture and a failing token test.**

Start the Vite server exactly as `frontend/tests/tracking.spec.js` does, use the installed Edge channel, mock `/auth/me`, `/api/dashboard`, `/api/stats/overview`, and neutralize `EventSource` with `page.addInitScript`.

```javascript
test('applies the approved graphite and mint foundation', async ({ page }) => {
  await mockDashboard(page)
  await page.goto(`${BASE_URL}/`)

  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    return {
      canvas: styles.getPropertyValue('--color-bg-canvas').trim(),
      surface: styles.getPropertyValue('--color-bg-surface').trim(),
      primary: styles.getPropertyValue('--color-action-primary').trim(),
      info: styles.getPropertyValue('--color-status-info').trim(),
      warning: styles.getPropertyValue('--color-status-warning').trim(),
      danger: styles.getPropertyValue('--color-status-danger').trim(),
    }
  })

  expect(tokens).toEqual({
    canvas: '#090d0f',
    surface: '#101619',
    primary: '#65c69c',
    info: '#67b9de',
    warning: '#ddb868',
    danger: '#e58a94',
  })
  await expect(page.getByRole('heading', { name: 'Обзор сервера' }))
    .toHaveCSS('font-family', /Unbounded/)
})
```

- [ ] **Step 2: Run the focused test and verify RED.**

Run: `cd frontend && npx playwright test tests/admin-dashboard-redesign.spec.js -g "approved graphite"`

Expected: FAIL because the semantic tokens and approved heading font are absent.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-dashboard-redesign.spec.js
git commit -m "test: define dashboard design foundation"
```

- [ ] **Step 4: Replace the legacy blurple token set with three token layers.**

Define primitive values, then semantic aliases, then component aliases. Preserve temporary compatibility aliases only where another page still consumes an old variable.

```css
:root {
  --graphite-950: #090d0f;
  --graphite-900: #0c1114;
  --graphite-850: #101619;
  --graphite-800: #151d21;
  --graphite-700: #253239;
  --neutral-050: #f2f6f4;
  --neutral-300: #a8b5b0;
  --mint-500: #65c69c;
  --mint-400: #79d3ae;
  --mint-600: #52ad86;
  --sky-500: #67b9de;
  --amber-500: #ddb868;
  --rose-500: #e58a94;

  --color-bg-canvas: var(--graphite-950);
  --color-bg-sidebar: var(--graphite-900);
  --color-bg-surface: var(--graphite-850);
  --color-bg-elevated: var(--graphite-800);
  --color-text-primary: var(--neutral-050);
  --color-text-secondary: var(--neutral-300);
  --color-action-primary: var(--mint-500);
  --color-status-success: var(--mint-500);
  --color-status-info: var(--sky-500);
  --color-status-warning: var(--amber-500);
  --color-status-danger: var(--rose-500);

  --button-primary-bg: var(--mint-500);
  --button-primary-hover-bg: var(--mint-400);
  --button-primary-pressed-bg: var(--mint-600);
}
```

- [ ] **Step 5: Map MUI to the semantic layer.**

Set `palette.primary`, `success`, `info`, `warning`, and `error` from the approved values. Use IBM Plex Sans for body/control text, Unbounded only for h1-h3 and brand moments, and IBM Plex Mono for captions that carry IDs, times, counters, or technical metadata. Remove gradient/glow styling from Button, Card, Paper, Progress, and the page canvas.

For `MuiButton-containedPrimary` implement:

```javascript
containedPrimary: {
  color: '#09110d',
  backgroundColor: 'var(--button-primary-bg)',
  border: '1px solid transparent',
  '&:hover': {
    backgroundColor: 'var(--button-primary-hover-bg)',
    borderColor: 'rgba(242, 246, 244, 0.28)',
    transform: 'translateY(-1px)',
  },
  '&:active': {
    backgroundColor: 'var(--button-primary-pressed-bg)',
    transform: 'translateY(0)',
  },
}
```

Keep outlined/secondary hover neutral: a brighter neutral border plus graphite elevated fill, never mint fill.

- [ ] **Step 6: Add global focus and motion fallbacks.**

Use a two-part focus indicator (`2px` mint outline plus canvas offset) that remains visible on mint controls. In `@media (prefers-reduced-motion: reduce)`, remove transform-based transitions and smooth scrolling.

- [ ] **Step 7: Run the focused test and existing frontend build.**

Run: `cd frontend && npm run build && npx playwright test tests/admin-dashboard-redesign.spec.js -g "approved graphite"`

Expected: build and focused browser test PASS.

- [ ] **Step 8: Commit the GREEN implementation.**

```bash
git add frontend/src/styles/tokens.css frontend/src/styles/typography.css frontend/src/styles/global.css frontend/src/styles/theme.js
git commit -m "feat: establish Vibe design tokens"
```

## Task 2: Build the responsive admin shell

**Files:**

- Modify: `frontend/tests/admin-dashboard-redesign.spec.js`
- Create: `frontend/src/components/BrandMark.jsx`
- Modify: `frontend/src/components/AppLayout.jsx`
- Modify: `frontend/src/styles/motion.jsx`

- [ ] **Step 1: Add failing desktop, mobile, and keyboard shell tests.**

```javascript
test('collapses the labelled desktop navigation into an accessible icon rail', async ({ page }) => {
  await mockDashboard(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE_URL}/`)

  await expect(page.getByRole('navigation', { name: 'Основная навигация' }))
    .toContainText('Обзор')
  await page.getByRole('button', { name: 'Свернуть меню' }).click()
  await expect(page.getByRole('button', { name: 'Развернуть меню' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Обзор' })).toHaveAttribute('aria-current', 'page')
})

test('uses a modal navigation drawer on mobile', async ({ page }) => {
  await mockDashboard(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE_URL}/`)

  await page.getByRole('button', { name: 'Открыть меню' }).click()
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeHidden()
})
```

- [ ] **Step 2: Run the shell tests and verify RED.**

Run: `cd frontend && npx playwright test tests/admin-dashboard-redesign.spec.js -g "navigation|mobile"`

Expected: FAIL because the existing fixed sidebar has no navigation landmark, link semantics, accessible toggle names, or mobile drawer.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-dashboard-redesign.spec.js
git commit -m "test: define responsive admin shell"
```

- [ ] **Step 4: Implement a restrained Vibe brand mark.**

Use a small geometric `V`/voice-wave SVG or CSS shape and text label. Do not use the robot emoji, Discord mark, gradients, or glow. Give the decorative shape `aria-hidden="true"` while the product name remains text.

- [ ] **Step 5: Restructure AppLayout with semantic navigation.**

Use MUI `Drawer` with `permanent` desktop behavior and `temporary` mobile behavior. Render items as React Router links so standard browser behavior works. Use these product labels while preserving existing paths:

- `Обзор`, `Правила`, `Участники`, `Кик-цели`, `Стаки`, `Отслеживание`, `Расписания`, `Журнал`, `Настройки`.

Persist desktop collapsed state under `vibe.admin.sidebarCollapsed`. On collapsed items, keep accessible names and show tooltips. Mark the active link with `aria-current="page"`; use a quiet mint keyline and tinted neutral background.

- [ ] **Step 6: Add the mobile top bar and content bounds.**

Below the desktop breakpoint, hide the permanent rail and show a compact bar containing the menu button, product name, and account avatar. Content uses a maximum readable width, 16 px mobile padding, 24 px tablet padding, and 32 px desktop padding.

- [ ] **Step 7: Run shell tests and build.**

Run: `cd frontend && npm run build && npx playwright test tests/admin-dashboard-redesign.spec.js -g "navigation|mobile"`

Expected: PASS at both viewports; Escape closes the mobile drawer and focus returns to the trigger.

- [ ] **Step 8: Commit the GREEN implementation.**

```bash
git add frontend/src/components/BrandMark.jsx frontend/src/components/AppLayout.jsx frontend/src/styles/motion.jsx
git commit -m "feat: redesign responsive admin shell"
```

## Task 3: Add only the reusable primitives required by Dashboard

**Files:**

- Modify: `frontend/tests/admin-dashboard-redesign.spec.js`
- Create: `frontend/src/components/ui/Panel.jsx`
- Create: `frontend/src/components/ui/StatusBadge.jsx`
- Modify: `frontend/src/components/ui/PageHeader.jsx`
- Modify: `frontend/src/components/ui/StatCard.jsx`
- Modify: `frontend/src/components/ui/EmptyState.jsx`
- Modify: `frontend/src/components/ui/LoadingState.jsx`
- Modify: `frontend/src/components/ui/ErrorState.jsx`
- Modify: `frontend/src/components/ui/ActionChip.jsx`
- Modify: `frontend/src/components/ui/index.js`

- [ ] **Step 1: Add failing state and interaction tests through the real Dashboard route.**

Test four API situations: populated, empty, dashboard error, and delayed loading. Assert `role="status"` for loading, retry behavior for error, and text-only empty messages without emoji. Add a primary action hover assertion and a neutral secondary action hover assertion so the two component families cannot regress together.

```javascript
test('keeps primary hover distinct without changing secondary semantics', async ({ page }) => {
  await mockDashboard(page)
  await page.goto(`${BASE_URL}/`)

  const primary = page.getByRole('button', { name: 'Создать правило' })
  const secondary = page.getByRole('link', { name: 'Все правила' })
  const before = await primary.evaluate(el => getComputedStyle(el).backgroundColor)
  await primary.hover()
  await expect.poll(() => primary.evaluate(el => getComputedStyle(el).backgroundColor))
    .not.toBe(before)
  await expect(secondary).not.toHaveCSS('background-color', 'rgb(101, 198, 156)')
})
```

- [ ] **Step 2: Run the component-state tests and verify RED.**

Run: `cd frontend && npx playwright test tests/admin-dashboard-redesign.spec.js -g "state|hover|empty|error|loading"`

Expected: FAIL because Dashboard and existing feedback components do not expose the approved controls and semantics.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-dashboard-redesign.spec.js
git commit -m "test: define dashboard component states"
```

- [ ] **Step 4: Implement Panel and StatusBadge.**

`Panel` accepts `title`, `description`, `action`, `children`, and `sx`; it uses a plain one-pixel neutral border and no hover effect unless explicitly interactive. `StatusBadge` accepts `tone="success|info|warning|danger|neutral"`, an optional dot, and children; semantic tone maps to the tokens rather than accepting arbitrary raw colors.

- [ ] **Step 5: Refactor existing primitives around semantic props.**

`StatCard` accepts `tone`, `label`, `value`, `meta`, and optional icon component. Remove `color` and `glowColor` from new call sites. `EmptyState` accepts an icon component rather than an emoji string. `ErrorState` accepts `onRetry`; the retry control is secondary. `LoadingState` announces concise text. Keep status color subordinate to readable text.

- [ ] **Step 6: Export the bounded UI layer.**

Add only `Panel` and `StatusBadge` to the barrel alongside refactored existing components. Do not create speculative primitives that this page does not use.

- [ ] **Step 7: Run state tests and build.**

Run: `cd frontend && npm run build && npx playwright test tests/admin-dashboard-redesign.spec.js -g "state|hover|empty|error|loading"`

Expected: PASS.

- [ ] **Step 8: Commit the GREEN implementation.**

```bash
git add frontend/src/components/ui frontend/src/styles/theme.js
git commit -m "feat: add dashboard design primitives"
```

## Task 4: Compose the Dashboard command center from real API data

**Files:**

- Modify: `frontend/tests/admin-dashboard-redesign.spec.js`
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Add a failing content-hierarchy test with realistic fixtures.**

Mock two voice members, two active rules, and three recent events. The Rule fixture must match `RuleResponse` (`id`, `name`, `is_active`, `is_dry_run`, `action_type`, `schedule_tz`, `priority`, timestamps, and optional fields). Assert that the page presents:

- `Обзор сервера` and a small live-status badge;
- concise metric strip, led by people in voice and active rules;
- `Сейчас в голосе`, `Что происходит`, and `Активные правила` panels;
- member name, channel, duration, action label, rule name, and technical identifiers in the right contexts;
- `Создать правило` primary action and `Все правила` secondary link.

- [ ] **Step 2: Run the content test and verify RED.**

Run: `cd frontend && npx playwright test tests/admin-dashboard-redesign.spec.js -g "command center"`

Expected: FAIL because the current page has four equal statistic cards, no active-rules panel, and the old page hierarchy.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-dashboard-redesign.spec.js
git commit -m "test: define dashboard command center"
```

- [ ] **Step 4: Build the page hierarchy.**

Use this desktop order:

1. page header with live state and `Создать правило`;
2. compact status strip for voice count, active rules, total actions, and latest event time;
3. two-column operational area: voice presence on the wider left, activity stream on the right;
4. full-width active-rules table with name, action, scope/schedule summary, priority, and dry-run state.

On small screens, stack in the same priority order and turn wide table rows into compact labelled records rather than horizontal overflow.

- [ ] **Step 5: Preserve fetching and SSE behavior.**

Keep the parallel initial requests. On retry, clear the prior error and set loading explicitly. On `voice_update`, refresh aggregate data. On `action_log`, prepend the new event and retain the 20-item cap. Malformed SSE payloads should be ignored with a warning rather than breaking the page.

- [ ] **Step 6: Remove visual noise.**

Replace emoji empty-state icons with MUI outline icons. Avoid repeated card shells around every number. Keep avatar, member name, channel, and elapsed time compact. Render raw IDs and rule numbers in IBM Plex Mono; keep human-readable names in IBM Plex Sans.

- [ ] **Step 7: Run content and existing tracking regression tests.**

Run: `cd frontend && npm run build && npx playwright test tests/admin-dashboard-redesign.spec.js tests/tracking.spec.js`

Expected: both specs PASS; existing `/tracking` workflows remain functional inside the new shell.

- [ ] **Step 8: Commit the GREEN implementation.**

```bash
git add frontend/src/pages/Dashboard.jsx
git commit -m "feat: redesign admin dashboard overview"
```

## Task 5: Verify responsive, accessible, and failure behavior

**Files:**

- Modify: `frontend/tests/admin-dashboard-redesign.spec.js`
- Modify only if a defect is found: Phase 1 source files listed above.

- [ ] **Step 1: Add final failing coverage for narrow screens and keyboard focus.**

At `390 x 844`, assert no document-level horizontal overflow, all dashboard sections remain visible, and every primary navigation/action target is at least 44 px high. Tab to `Создать правило`, assert a visible focus outline, and run the same check after emulating reduced motion.

- [ ] **Step 2: Run final focused coverage and verify RED if a gap exists.**

Run: `cd frontend && npx playwright test tests/admin-dashboard-redesign.spec.js -g "responsive|keyboard|reduced motion"`

Expected: any remaining layout or focus gap is exposed before final polish.

- [ ] **Step 3: Commit the RED checkpoint.**

```bash
git add frontend/tests/admin-dashboard-redesign.spec.js
git commit -m "test: cover dashboard responsive accessibility"
```

- [ ] **Step 4: Fix only failures demonstrated by the final tests.**

Use token or component-level fixes when the issue is systemic; use page-local fixes only when the issue belongs uniquely to Dashboard. Do not widen this task into redesigning other admin pages.

- [ ] **Step 5: Run complete Phase 1 verification.**

Run: `cd frontend && npm run build && npx playwright test tests/admin-dashboard-redesign.spec.js tests/tracking.spec.js`

Expected: build succeeds and both browser suites PASS.

- [ ] **Step 6: Inspect the final change set.**

Run: `git diff --check && git status --short && git log --oneline -12`

Expected: no whitespace errors; only planned source/test/docs changes plus the user's pre-existing untracked `.superpowers/` directory. Do not add `.superpowers/` to any commit.

- [ ] **Step 7: Commit the final GREEN fixes, if any.**

```bash
git add frontend/tests/admin-dashboard-redesign.spec.js frontend/src
git commit -m "fix: complete dashboard redesign verification"
```

## Follow-on Plans

After Phase 1 is visually accepted in the real interface:

1. migrate the remaining admin pages to the proven tokens and primitives;
2. implement access routing and the authenticated member portal with personal level/progress/status;
3. implement the unauthenticated single-server landing and sign-in flow.

This order avoids designing a large abstract library before product needs are visible, while also avoiding page-by-page styling drift.

## Plan Self-Review

- Spec coverage: this phase covers the approved visual foundation, admin shell, and Dashboard command center; deferred surfaces are explicitly listed rather than silently omitted.
- Data fit: active rules, voice count, recent logs, and total actions all come from existing frontend API functions and backend schemas; no backend contract is invented.
- Interaction completeness: loading, empty, error/retry, hover, pressed, disabled, focus, collapse, mobile drawer, SSE update, and reduced-motion behavior are covered.
- Visual consistency: all color comes through semantic tokens; primary hover is distinguishable but restrained; secondary controls stay neutral.
- Dependency safety: no new package, route migration, database change, or auth change is required.
- TDD compliance: each behavioral slice starts with a focused failing Playwright checkpoint, commits RED separately, implements minimally, verifies GREEN, and commits implementation separately.
