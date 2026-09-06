import { createRequire } from 'node:module'
import { createServer } from 'vite'

const requireFromRunner = createRequire(process.argv[1])
const { test, expect } = requireFromRunner('playwright/test')

// A distinct port from admin-dashboard-redesign.spec.js (5173) and
// tracking.spec.js (5174) — each spec file spins up its own `vite` instance
// in beforeAll/afterAll and Playwright runs spec files in parallel workers
// by default, so a shared port would let whichever file finishes first tear
// down the server the other file's still-running tests are navigating
// against (ERR_CONNECTION_REFUSED).
const BASE_URL = 'http://127.0.0.1:5175'

let devServer

test.beforeAll(async () => {
  devServer = await createServer({
    server: { host: '127.0.0.1', port: 5175 },
    logLevel: 'error',
  })
  await devServer.listen()
})

test.afterAll(async () => {
  await devServer?.close()
})

test.use({ launchOptions: { channel: 'msedge' } })

// A promise with its resolve exposed, for gating a mocked route response
// until the test explicitly lets it through — used to assert pending-state
// UI (disabled controls, blocked Escape/backdrop dismissal) deterministically
// instead of racing a real network response.
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

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

// Mocks the authenticated admin identity plus the full /api/rules CRUD
// surface (list/create/update/toggle/delete) against an in-memory fixture
// list, optionally gating the create/update or delete response on a
// `deferred()` so tests can assert pending-state behavior deterministically.
async function mockRules(page, initialRules, { saveGate, deleteGate } = {}) {
  const state = {
    rules: initialRules.map(r => ({ ...r })),
    createdPayload: null,
    updatedPayload: null,
    deletedId: null,
  }

  await page.route('**/auth/me', route => route.fulfill({
    json: { id: '1', username: 'Admin', avatar: null },
  }))

  await page.route('**/api/rules**', async route => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const match = url.pathname.match(/^\/api\/rules(?:\/(\d+))?(?:\/(toggle))?\/?$/)
    const id = match?.[1] ? Number(match[1]) : null
    const isToggle = !!match?.[2]

    if (method === 'GET' && id === null) {
      return route.fulfill({ json: state.rules })
    }
    if (method === 'POST' && id === null) {
      const body = await request.postDataJSON()
      state.createdPayload = body
      const now = '2026-09-06T12:00:00Z'
      const created = {
        id: Math.max(0, ...state.rules.map(r => r.id)) + 1,
        created_at: now,
        updated_at: now,
        ...body,
      }
      if (saveGate) await saveGate.promise
      state.rules = [...state.rules, created]
      return route.fulfill({ json: created })
    }
    if (method === 'PUT' && id !== null) {
      const body = await request.postDataJSON()
      state.updatedPayload = body
      if (saveGate) await saveGate.promise
      state.rules = state.rules.map(r => (r.id === id ? { ...r, ...body, updated_at: '2026-09-06T12:05:00Z' } : r))
      return route.fulfill({ json: state.rules.find(r => r.id === id) })
    }
    if (method === 'PATCH' && id !== null && isToggle) {
      state.rules = state.rules.map(r => (r.id === id ? { ...r, is_active: !r.is_active } : r))
      return route.fulfill({ json: state.rules.find(r => r.id === id) })
    }
    if (method === 'DELETE' && id !== null) {
      state.deletedId = id
      if (deleteGate) await deleteGate.promise
      state.rules = state.rules.filter(r => r.id !== id)
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ status: 404, json: { detail: 'not found' } })
  })

  return state
}

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

test('rules page uses Russian labels for the page title and table headers', async ({ page }) => {
  await mockRules(page, [ruleFixture])
  await page.goto(`${BASE_URL}/rules`)

  await expect(page.getByRole('heading', { name: 'Правила' })).toBeVisible()
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader', { name: 'Название' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Список' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Каналы' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Действие' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Приоритет' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Статус' })).toBeVisible()
})

test('rules shows semantic StatusBadge text for active state and blacklist target', async ({ page }) => {
  await mockRules(page, [ruleFixture]) // is_active: true, target_list: 'blacklist'
  await page.goto(`${BASE_URL}/rules`)

  await expect(page.getByText('Активно', { exact: true })).toBeVisible()
  await expect(page.getByText('Чёрный список', { exact: true })).toBeVisible()
})

test('rules shows semantic StatusBadge text for inactive state and whitelist target', async ({ page }) => {
  await mockRules(page, [{ ...ruleFixture, is_active: false, target_list: 'whitelist' }])
  await page.goto(`${BASE_URL}/rules`)

  await expect(page.getByText('Неактивно', { exact: true })).toBeVisible()
  await expect(page.getByText('Белый список', { exact: true })).toBeVisible()
})

test('rules focuses the first drawer field on open', async ({ page }) => {
  await mockRules(page, [ruleFixture])
  await page.goto(`${BASE_URL}/rules`)
  await page.getByRole('button', { name: 'Создать правило' }).click()

  await expect(page.getByLabel('Название')).toBeFocused()
})

test('rules requires a name and a valid action before saving', async ({ page }) => {
  await mockRules(page, [ruleFixture])
  await page.goto(`${BASE_URL}/rules`)
  await page.getByRole('button', { name: 'Создать правило' }).click()
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByText('Название обязательно')).toBeVisible()
  await expect(page.getByText('Действие обязательно')).toBeVisible()
})

test('rules reports invalid action params JSON beside the field', async ({ page }) => {
  await mockRules(page, [ruleFixture])
  await page.goto(`${BASE_URL}/rules`)
  await page.getByRole('button', { name: 'Редактировать: Лимит времени' }).click()
  await page.getByLabel('Параметры действия (JSON)').fill('{invalid')
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByText('Невалидный JSON')).toBeVisible()
})

test('rules cannot toggle the same rule twice while a toggle is pending', async ({ page }) => {
  const toggleGate = deferred()
  let toggleCalls = 0
  await page.route('**/auth/me', route => route.fulfill({ json: { id: '1', username: 'Admin', avatar: null } }))
  await page.route('**/api/rules**', async route => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    if (method === 'GET' && url.pathname === '/api/rules') {
      return route.fulfill({ json: [ruleFixture] })
    }
    if (method === 'PATCH' && url.pathname === '/api/rules/7/toggle') {
      toggleCalls += 1
      await toggleGate.promise
      return route.fulfill({ json: { ...ruleFixture, is_active: false } })
    }
    return route.fulfill({ status: 404, json: { detail: 'not found' } })
  })
  await page.goto(`${BASE_URL}/rules`)

  const toggle = page.getByRole('checkbox').first()
  await toggle.click()
  await expect(toggle).toBeDisabled()
  await toggle.click({ force: true })

  expect(toggleCalls).toBe(1)
  toggleGate.resolve()
})

test('rules has no document overflow at 390x844', async ({ page }) => {
  await mockRules(page, [ruleFixture])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE_URL}/rules`)

  await expect(page.getByRole('heading', { name: 'Правила' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
