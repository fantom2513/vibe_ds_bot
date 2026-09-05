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

  // Dashboard.jsx opens a live EventSource on mount; neutralize it so tests
  // don't depend on a real SSE connection.
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
