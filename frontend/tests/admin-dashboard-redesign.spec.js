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

  // The plan's reference test also asserts:
  //   await expect(page.getByRole('heading', { name: 'Обзор сервера' }))
  //     .toHaveCSS('font-family', /Unbounded/)
  // That heading is introduced by the Dashboard.jsx redesign, which is Task 4
  // of this plan — it does not exist yet. Rather than invent Dashboard
  // content that isn't this task's job, the Unbounded/h1-h3 typography
  // contract is locked below via the theme module directly (see "locks
  // Unbounded for h1-h3 only"). Task 4 must re-add a browser-level
  // assertion equivalent to the one above once the real heading exists.
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
  // The plan's reference test targets Dashboard's "Создать правило" primary
  // action and "Все правила" secondary link — neither exists yet; both are
  // introduced by Task 4's Dashboard rebuild. This exercises the exact same
  // two component families (MuiButton containedPrimary vs. the AppLayout
  // sidebar's NavLink) through routes that already exist today: Rules' real
  // "Новое правило" primary action and the sidebar's "Обзор" secondary nav
  // link. Task 4 should add the literal snippet from the plan once the
  // Dashboard controls exist; this stays as a standing regression guard for
  // the shared button/link theme so the two families can't drift together.
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
