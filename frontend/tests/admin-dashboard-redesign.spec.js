import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { theme } from '../src/styles/theme.js'

const requireFromRunner = createRequire(process.argv[1])
const { test, expect } = requireFromRunner('playwright/test')

const BASE_URL = 'http://127.0.0.1:5173'

let devServer

test.beforeAll(async () => {
  devServer = await createServer({
    server: { host: '127.0.0.1', port: 5173 },
    logLevel: 'error',
  })
  await devServer.listen()
})

test.afterAll(async () => {
  await devServer?.close()
})

test.use({ launchOptions: { channel: 'msedge' } })

const dashboardFixture = {
  active_rules: [],
  voice_online_count: 0,
  online_users: [],
  recent_logs: [],
}

const statsOverviewFixture = {
  total_actions: 0,
}

// Dashboard.jsx opens a live EventSource on mount; neutralize it so tests
// don't depend on a real SSE connection.
async function neutralizeEventSource(page) {
  await page.addInitScript(() => {
    class NoopEventSource {
      constructor() {}
      addEventListener() {}
      removeEventListener() {}
      close() {}
    }
    window.EventSource = NoopEventSource
  })
}

async function mockDashboard(page) {
  await page.route('**/auth/me', route => route.fulfill({
    json: { id: '1', username: 'Admin', avatar: null },
  }))
  await page.route('**/api/dashboard', route => route.fulfill({
    json: dashboardFixture,
  }))
  await page.route('**/api/stats/overview', route => route.fulfill({
    json: statsOverviewFixture,
  }))

  await neutralizeEventSource(page)
}

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

const populatedDashboardFixture = {
  active_rules: [{ id: 1 }, { id: 2 }],
  voice_online_count: 3,
  online_users: [
    { user_id: '1', username: 'Ada Lovelace', avatar: null, channel_name: 'General', joined_at: '2026-09-05T10:00:00Z' },
  ],
  recent_logs: [
    { id: 1, executed_at: '2026-09-05T10:05:00Z', discord_id: '123', action_type: 'mute', rule_id: 7, is_dry_run: false, channel_id: null },
  ],
}

// Renders a UI primitive to static markup inside the already-running app
// document (so the real global CSS / Emotion insertion point is active) via
// Vite's ESM dev-server module graph (tests/harness/renderStatic.js), without
// wiring the primitive into any page route. Used for the Panel/StatusBadge
// assertions below: Task 3 adds these two primitives but nothing consumes
// them yet (Panel has zero real callers until Task 4's Dashboard rebuild), so
// there is no live route to exercise them through — this is the "minimal
// test harness within the spec file" the plan calls out as the alternative
// to inventing Dashboard markup.
async function renderPrimitive(page, modulePath, exportName, props, childText) {
  return await page.evaluate(async ([modulePath, exportName, props, childText]) => {
    const mod = await import(modulePath)
    const Comp = mod[exportName]
    const harness = await import('/tests/harness/renderStatic.js')
    const container = document.createElement('div')
    container.setAttribute('data-harness-root', '')
    document.body.appendChild(container)
    const unmount = await harness.mountElement(container, Comp, props, childText)
    const el = container.firstElementChild
    const cs = getComputedStyle(el)
    const result = {
      text: el.textContent,
      borderWidth: cs.borderWidth,
      borderColor: cs.borderColor,
      boxShadow: cs.boxShadow,
      backgroundColor: cs.backgroundColor,
      color: cs.color,
    }
    unmount()
    container.remove()
    return result
  }, [modulePath, exportName, props, childText])
}

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

  // Task 4 re-adds the plan's original browser-level assertion now that the
  // real Dashboard heading exists (the h1-h3/Unbounded contract is also
  // locked at the theme-module level below, see "locks Unbounded for h1-h3
  // only" — this is the live-route confirmation of that same contract).
  await expect(page.getByRole('heading', { name: 'Обзор сервера' }))
    .toHaveCSS('font-family', /Unbounded/)
})

test('locks Unbounded for h1-h3 only, IBM Plex Sans elsewhere', () => {
  const heading = variant => theme.typography[variant]?.fontFamily ?? ''

  expect(heading('h1')).toMatch(/Unbounded/)
  expect(heading('h2')).toMatch(/Unbounded/)
  expect(heading('h3')).toMatch(/Unbounded/)

  expect(heading('h4')).not.toMatch(/Unbounded/)
  expect(heading('h5')).not.toMatch(/Unbounded/)
  expect(heading('h6')).not.toMatch(/Unbounded/)
  expect(theme.typography.fontFamily).not.toMatch(/Unbounded/)
  expect(theme.typography.fontFamily).toMatch(/IBM Plex Sans/)
})

test('carries IBM Plex Mono for technical captions', () => {
  expect(theme.typography.caption?.fontFamily).toMatch(/IBM Plex Mono/)
})

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

test('persists the collapsed sidebar rail across a reload', async ({ page }) => {
  await mockDashboard(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE_URL}/`)

  await page.getByRole('button', { name: 'Свернуть меню' }).click()
  await expect(page.getByRole('button', { name: 'Развернуть меню' })).toBeVisible()

  const stored = await page.evaluate(() => window.localStorage.getItem('vibe.admin.sidebarCollapsed'))
  expect(stored).toBe('true')

  await page.reload()

  await expect(page.getByRole('button', { name: 'Развернуть меню' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Свернуть меню' })).toHaveCount(0)
})

test('uses a modal navigation drawer on mobile', async ({ page }) => {
  await mockDashboard(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE_URL}/`)

  await page.getByRole('button', { name: 'Открыть меню' }).click()
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Открыть меню' })).toBeFocused()
})

// ---------------------------------------------------------------------------
// Task 3 — dashboard component states (loading / empty / error / populated)
// and the shared primitives (Panel, StatusBadge, StatCard, ActionChip,
// EmptyState, ErrorState, LoadingState) that back them.
// ---------------------------------------------------------------------------

test('dashboard state: renders populated stats and events with no decorative brand color', async ({ page }) => {
  await page.route('**/auth/me', route => route.fulfill({ json: { id: '1', username: 'Admin', avatar: null } }))
  await page.route('**/api/dashboard', route => route.fulfill({ json: populatedDashboardFixture }))
  await page.route('**/api/stats/overview', route => route.fulfill({ json: { total_actions: 12 } }))
  await neutralizeEventSource(page)
  await page.goto(`${BASE_URL}/`)

  // Stat values render through the real route.
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Ada Lovelace')).toBeVisible()

  // The old StatCard took a raw `color` prop and Dashboard.jsx passed Discord
  // blurple (#5865F2) for the first card's icon tile. The refactored StatCard
  // takes a semantic `tone` instead, so no element on the page should carry
  // a blurple-derived background any more.
  const hasBlurple = await page.evaluate(() => {
    const blurple = /88,\s*101,\s*242/
    return Array.from(document.querySelectorAll('*')).some(el => {
      const bg = getComputedStyle(el).backgroundColor
      return blurple.test(bg)
    })
  })
  expect(hasBlurple).toBe(false)

  // ActionChip is rebuilt on StatusBadge, whose tones map to the approved
  // status tokens rather than the old component's own hardcoded hex map.
  const muteChip = page.getByText('mute', { exact: true })
  await expect(muteChip).toBeVisible()
  await expect(muteChip).toHaveCSS('color', 'rgb(221, 184, 104)') // --color-status-warning
})

test('dashboard state: shows text-only empty messages without emoji', async ({ page }) => {
  await mockDashboard(page) // dashboardFixture has empty online_users / recent_logs
  await page.goto(`${BASE_URL}/`)

  await expect(page.getByText('Никого нет в голосовых каналах')).toBeVisible()
  await expect(page.getByText('Нет событий')).toBeVisible()

  const bodyText = await page.locator('body').innerText()
  const emojiPattern = /\p{Extended_Pictographic}/u
  expect(emojiPattern.test(bodyText)).toBe(false)
})

test('dashboard state: shows a secondary retry control on error and recovers', async ({ page }) => {
  let dashboardCalls = 0
  await page.route('**/auth/me', route => route.fulfill({ json: { id: '1', username: 'Admin', avatar: null } }))
  await page.route('**/api/dashboard', route => {
    dashboardCalls += 1
    if (dashboardCalls === 1) {
      return route.fulfill({ status: 500, json: { detail: 'Internal error' } })
    }
    return route.fulfill({ json: dashboardFixture })
  })
  await page.route('**/api/stats/overview', route => route.fulfill({ json: statsOverviewFixture }))
  await neutralizeEventSource(page)
  await page.goto(`${BASE_URL}/`)

  await expect(page.getByRole('alert')).toBeVisible()
  const retry = page.getByRole('button', { name: 'Повторить' })
  await expect(retry).toBeVisible()

  // The retry control must read as secondary, not the loud primary CTA.
  const retryBg = await retry.evaluate(el => getComputedStyle(el).backgroundColor)
  expect(retryBg).not.toBe('rgb(101, 198, 156)')

  await retry.click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(dashboardCalls).toBe(2)
})

test('dashboard state: exposes role=status while loading', async ({ page }) => {
  const gate = deferred()
  await page.route('**/auth/me', route => route.fulfill({ json: { id: '1', username: 'Admin', avatar: null } }))
  await page.route('**/api/dashboard', async route => {
    await gate.promise
    return route.fulfill({ json: dashboardFixture })
  })
  await page.route('**/api/stats/overview', route => route.fulfill({ json: statsOverviewFixture }))
  await neutralizeEventSource(page)
  await page.goto(`${BASE_URL}/`)

  const status = page.getByRole('status')
  await expect(status).toBeVisible()
  await expect(status).toContainText('Загрузка')

  gate.resolve()
  await expect(status).toHaveCount(0)
})

test('keeps primary hover distinct without changing secondary nav semantics', async ({ page }) => {
  // Exercises the two shared component families (MuiButton containedPrimary
  // vs. an anchor-backed nav/link control) through two independent routes:
  // Rules' real "Новое правило" primary action + the sidebar's "Обзор"
  // secondary nav link (a standing regression guard for the shared
  // button/link theme so the families can't drift apart), and — per the
  // plan's original reference test, now that Task 4 has built the real
  // markup — Dashboard's own "Создать правило" primary action and "Все
  // правила" secondary link.
  await page.route('**/auth/me', route => route.fulfill({ json: { id: '1', username: 'Admin', avatar: null } }))
  await page.route('**/api/rules', route => route.fulfill({ json: [] }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE_URL}/rules`)

  const primary = page.getByRole('button', { name: 'Новое правило' })
  const secondary = page.getByRole('link', { name: 'Обзор' })

  const before = await primary.evaluate(el => getComputedStyle(el).backgroundColor)
  await primary.hover()
  await expect.poll(() => primary.evaluate(el => getComputedStyle(el).backgroundColor))
    .not.toBe(before)

  await expect(secondary).not.toHaveCSS('background-color', 'rgb(101, 198, 156)')
  await secondary.hover()
  await expect(secondary).not.toHaveCSS('background-color', 'rgb(101, 198, 156)')

  // The plan's literal reference assertion, now through the real Dashboard route.
  await page.route('**/api/dashboard', route => route.fulfill({ json: dashboardFixture }))
  await page.route('**/api/stats/overview', route => route.fulfill({ json: statsOverviewFixture }))
  await neutralizeEventSource(page)
  await page.goto(`${BASE_URL}/`)

  const dashPrimary = page.getByRole('button', { name: 'Создать правило' })
  const dashSecondary = page.getByRole('link', { name: 'Все правила' })

  const dashBefore = await dashPrimary.evaluate(el => getComputedStyle(el).backgroundColor)
  await dashPrimary.hover()
  await expect.poll(() => dashPrimary.evaluate(el => getComputedStyle(el).backgroundColor))
    .not.toBe(dashBefore)

  await expect(dashSecondary).not.toHaveCSS('background-color', 'rgb(101, 198, 156)')
  await dashSecondary.hover()
  await expect(dashSecondary).not.toHaveCSS('background-color', 'rgb(101, 198, 156)')
})

test('Panel primitive state: neutral bordered surface with no hover shadow', async ({ page }) => {
  await mockDashboard(page)
  await page.goto(`${BASE_URL}/`)

  const styles = await renderPrimitive(
    page,
    '/src/components/ui/Panel.jsx',
    'Panel',
    { title: 'Harness Panel', description: 'desc' },
    'Body content',
  )

  expect(styles.borderWidth).toBe('1px')
  expect(styles.boxShadow).toBe('none')
})

test('StatusBadge primitive state: semantic tone maps to approved tokens, not arbitrary colors', async ({ page }) => {
  await mockDashboard(page)
  await page.goto(`${BASE_URL}/`)

  const success = await renderPrimitive(
    page, '/src/components/ui/StatusBadge.jsx', 'StatusBadge', { tone: 'success' }, 'ok',
  )
  expect(success.color).toBe('rgb(101, 198, 156)') // --color-status-success

  const danger = await renderPrimitive(
    page, '/src/components/ui/StatusBadge.jsx', 'StatusBadge', { tone: 'danger' }, 'bad',
  )
  expect(danger.color).toBe('rgb(229, 138, 148)') // --color-status-danger
})

// ---------------------------------------------------------------------------
// Task 4 — the Dashboard command center: real content hierarchy built from
// realistic fixtures (RuleResponse-shaped rules, voice presence, an action
// event stream).
// ---------------------------------------------------------------------------

const commandCenterRules = [
  {
    id: 5,
    name: 'Тихий час',
    description: null,
    is_active: true,
    is_dry_run: false,
    target_list: null,
    channel_ids: null,
    max_time_sec: 3600,
    action_type: 'mute',
    action_params: {},
    schedule_cron: null,
    schedule_tz: 'Europe/Moscow',
    priority: 10,
    created_at: '2026-08-01T09:00:00Z',
    updated_at: '2026-08-01T09:00:00Z',
  },
  {
    id: 8,
    name: 'Ночной кик',
    description: 'Тестовый прогон перед боевым запуском',
    is_active: true,
    is_dry_run: true,
    target_list: 'blacklist',
    channel_ids: [111, 222],
    max_time_sec: null,
    action_type: 'kick',
    action_params: {},
    schedule_cron: '0 3 * * *',
    schedule_tz: 'Europe/Moscow',
    priority: 3,
    created_at: '2026-08-02T09:00:00Z',
    updated_at: '2026-08-03T09:00:00Z',
  },
]

const commandCenterVoiceMembers = [
  { user_id: '111', username: 'Ada Lovelace', avatar: null, channel_name: 'General', joined_at: '2026-09-05T09:40:00Z' },
  { user_id: '222', username: 'Grace Hopper', avatar: null, channel_name: 'Штаб', joined_at: '2026-09-05T09:55:00Z' },
]

const commandCenterEvents = [
  { id: 301, executed_at: '2026-09-05T10:05:00Z', discord_id: '111', action_type: 'mute', rule_id: 5, is_dry_run: false, channel_id: null },
  { id: 300, executed_at: '2026-09-05T10:00:00Z', discord_id: '222', action_type: 'kick', rule_id: 8, is_dry_run: true, channel_id: 333 },
  { id: 299, executed_at: '2026-09-05T09:55:00Z', discord_id: '111', action_type: 'unmute', rule_id: null, is_dry_run: false, channel_id: null },
]

const commandCenterDashboardFixture = {
  active_rules: commandCenterRules,
  recent_logs: commandCenterEvents,
  voice_online_count: 2,
  online_users: commandCenterVoiceMembers,
}

test('command center: presents the server overview hierarchy with realistic fixtures', async ({ page }) => {
  await page.route('**/auth/me', route => route.fulfill({ json: { id: '1', username: 'Admin', avatar: null } }))
  await page.route('**/api/dashboard', route => route.fulfill({ json: commandCenterDashboardFixture }))
  await page.route('**/api/stats/overview', route => route.fulfill({ json: { total_actions: 42 } }))
  await neutralizeEventSource(page)
  await page.goto(`${BASE_URL}/`)

  // Header: Unbounded heading, a small live-status badge, primary CTA.
  const heading = page.getByRole('heading', { name: 'Обзор сервера' })
  await expect(heading).toBeVisible()
  await expect(heading).toHaveCSS('font-family', /Unbounded/)
  await expect(page.getByText('В сети', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Создать правило' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Все правила' })).toBeVisible()

  // Compact metric strip, led by people in voice and active rules.
  const metrics = page.getByRole('list', { name: 'Ключевые показатели' }).getByRole('listitem')
  await expect(metrics).toHaveCount(4)
  const metricTexts = await metrics.allInnerTexts()
  expect(metricTexts[0]).toMatch(/голос/i)
  expect(metricTexts[0]).toContain('2')
  expect(metricTexts[1]).toMatch(/правил/i)
  expect(metricTexts[1]).toContain('2')
  expect(metricTexts[2]).toContain('42')

  // The three named panels.
  await expect(page.getByRole('heading', { name: 'Сейчас в голосе' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Что происходит' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Активные правила' })).toBeVisible()

  // Voice presence: member name, channel, duration.
  const voiceTable = page.getByRole('table', { name: 'Сейчас в голосе' })
  await expect(voiceTable.getByText('Ada Lovelace')).toBeVisible()
  await expect(voiceTable.getByText('General')).toBeVisible()
  await expect(voiceTable.getByText('Grace Hopper')).toBeVisible()
  await expect(voiceTable.getByText('Штаб')).toBeVisible()
  const firstVoiceRowCells = await voiceTable.getByRole('row').nth(1).getByRole('cell').allInnerTexts()
  expect(firstVoiceRowCells[firstVoiceRowCells.length - 1].trim()).not.toBe('')
  expect(firstVoiceRowCells[firstVoiceRowCells.length - 1].trim()).not.toBe('—')

  // Event stream: action label, rule name, technical identifiers.
  await expect(page.getByText('unmute', { exact: true })).toBeVisible()
  await expect(page.getByText('kick', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Без правила')).toBeVisible()
  await expect(page.getByText('Тихий час')).toHaveCount(2) // active-rules row + event row (rule_id 5)
  await expect(page.getByText('Ночной кик')).toHaveCount(2) // active-rules row + event row (rule_id 8)

  const rawDiscordId = page.getByText('111', { exact: true }).first()
  await expect(rawDiscordId).toBeVisible()
  await expect(rawDiscordId).toHaveCSS('font-family', /IBM Plex Mono/)

  // Active rules table: name, action, scope/schedule summary, priority,
  // dry-run state, plus a mono technical identifier for the rule.
  const rulesTable = page.getByRole('table', { name: 'Активные правила' })
  await expect(rulesTable.getByText('Тихий час')).toBeVisible()
  await expect(rulesTable.getByText('Ночной кик')).toBeVisible()
  const ruleId = rulesTable.getByText('#5', { exact: true })
  await expect(ruleId).toBeVisible()
  await expect(ruleId).toHaveCSS('font-family', /IBM Plex Mono/)
  await expect(rulesTable.getByText('10', { exact: true })).toBeVisible() // priority
  await expect(rulesTable.getByText('DRY-RUN')).toBeVisible()
  await expect(rulesTable.getByText('Боевой')).toBeVisible()
  await expect(rulesTable.getByText('Постоянно')).toBeVisible() // no cron -> always-on schedule
  await expect(rulesTable.getByText('Europe/Moscow').first()).toBeVisible()
})
