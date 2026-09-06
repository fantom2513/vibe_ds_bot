import { createRequire } from 'node:module'
import { createServer } from 'vite'
import cronstrue from 'cronstrue/i18n.js'

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

  // Anchored to the end of the URL (optionally followed by a query string)
  // so this only matches the real `/api/rules...` endpoints — a loose
  // `**/api/rules**` glob also matches Vite's dev-server module URL for the
  // source file `src/api/rules.js`, hijacking that JS module request and
  // serving it JSON, which crashes the whole app before it can render.
  await page.route(/\/api\/rules(?:\/(\d+))?(?:\/(toggle))?\/?(?:\?.*)?$/, async route => {
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
  await page.getByLabel('Каналы (ID через запятую, пусто = все)').fill('111, 222')
  await page.getByLabel('Действие').click()
  await page.getByRole('option', { name: 'Заглушить' }).click()
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect.poll(() => state.createdPayload?.name).toBe('Ночное ограничение')
  expect(state.createdPayload.description).toBe('Ограничение для ночного канала')
  expect(state.createdPayload.channel_ids).toEqual([111, 222])
  expect(state.createdPayload.channel_ids.every(id => typeof id === 'number')).toBe(true)
})

test('rules rejects non-numeric channel IDs and blocks submission', async ({ page }) => {
  const state = await mockRules(page, [ruleFixture])
  await page.goto(`${BASE_URL}/rules`)
  await page.getByRole('button', { name: 'Создать правило' }).click()
  await page.getByLabel('Название').fill('Правило с опечаткой')
  await page.getByLabel('Каналы (ID через запятую, пусто = все)').fill('123, abc')
  await page.getByLabel('Действие').click()
  await page.getByRole('option', { name: 'Заглушить' }).click()
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByText('Каналы должны быть числовыми ID через запятую')).toBeVisible()
  expect(state.createdPayload).toBeNull()
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
  await page.route(/\/api\/rules(?:\/(\d+))?(?:\/(toggle))?\/?(?:\?.*)?$/, async route => {
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

  const toggle = page.getByRole('switch').first()
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

// ---------------------------------------------------------------------------
// Task 2: member-management workflows (Users / KickTargets / StackingPairs)
// ---------------------------------------------------------------------------

const listedUser = {
  discord_id: '42', list_type: 'whitelist', username: 'Ada',
  reason: null, created_at: '2026-09-06T10:00:00Z',
}
const kickTargetFixture = {
  discord_id: '42', username: 'Ada', timeout_sec: 1800,
  max_timeout_sec: 3600, is_active: true,
}
const stackingPairFixture = {
  id: 4, user_id_1: '42', user_id_2: '84',
  target_channel_id: '100', is_active: true,
  created_at: '2026-09-06T10:00:00Z',
}

// Complete {id, username, display_name, label, avatar} member records, as
// returned by the real /api/members search/batch/single routes, keyed by
// discord_id so route handlers below can look members up directly.
const memberFixtures = {
  '42': { id: '42', username: 'Ada', display_name: 'Ada', label: 'Ada', avatar: null },
  '84': { id: '84', username: 'Boris', display_name: 'Boris', label: 'Boris', avatar: null },
}

// Mocks the authenticated admin identity plus the full /api/users,
// /api/kick-targets, /api/stacking-pairs, and /api/members surfaces used by
// Users, KickTargets, and StackingPairs against in-memory fixture lists.
// `gates` optionally defers specific mutation responses (see deferred())
// so tests can assert pending-state UI deterministically; each gated route
// also increments a `*Calls` counter so tests can assert a blocked duplicate
// request never reached the mock a second time.
async function mockMemberManagement(page, {
  users = [listedUser],
  kickTargets = [kickTargetFixture],
  pairs = [stackingPairFixture],
  gates = {},
} = {}) {
  const state = {
    users: users.map(u => ({ ...u })),
    kickTargets: kickTargets.map(t => ({ ...t })),
    pairs: pairs.map(p => ({ ...p })),
    createdUserPayload: null,
    deletedUserId: null,
    createdKickPayload: null,
    updatedKickPayload: null,
    deletedKickId: null,
    kickToggleCalls: 0,
    createdPairPayload: null,
    deletedPairId: null,
    pairToggleCalls: 0,
  }

  await page.route('**/auth/me', route => route.fulfill({
    json: { id: '1', username: 'Admin', avatar: null },
  }))

  // Anchored the same way as mockRules' /api/rules route so this only
  // matches the real endpoint and never Vite's dev-server module URL for
  // the source file src/api/members.js.
  await page.route(/\/api\/members(?:\/([^/?]+))?\/?(?:\?.*)?$/, async route => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const match = url.pathname.match(/^\/api\/members(?:\/([^/?]+))?\/?$/)
    const segment = match?.[1] ?? null

    if (method === 'GET' && segment === null) {
      const q = (url.searchParams.get('q') || '').toLowerCase()
      const results = Object.values(memberFixtures).filter(m =>
        !q || m.display_name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)
      )
      return route.fulfill({ json: results })
    }
    if (method === 'POST' && segment === 'batch') {
      const ids = await request.postDataJSON()
      const result = {}
      ids.forEach(id => {
        result[id] = memberFixtures[id] || {
          id, username: id, display_name: 'Unknown', avatar: null, label: `Unknown (@${id})`,
        }
      })
      return route.fulfill({ json: result })
    }
    if (method === 'GET' && segment !== null) {
      const member = memberFixtures[segment]
      if (!member) return route.fulfill({ status: 404, json: { detail: 'not found' } })
      return route.fulfill({ json: member })
    }
    return route.fulfill({ status: 404, json: { detail: 'not found' } })
  })

  await page.route(/\/api\/users(?:\/([^/?]+))?\/?(?:\?.*)?$/, async route => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const match = url.pathname.match(/^\/api\/users(?:\/([^/?]+))?\/?$/)
    const id = match?.[1] ?? null
    const listType = url.searchParams.get('list_type')

    if (method === 'GET' && id === null) {
      return route.fulfill({ json: state.users.filter(u => u.list_type === listType) })
    }
    if (method === 'POST' && id === null) {
      const body = await request.postDataJSON()
      state.createdUserPayload = body
      if (gates.userSave) await gates.userSave.promise
      const created = { reason: null, created_at: '2026-09-06T12:00:00Z', ...body, discord_id: String(body.discord_id) }
      state.users = [...state.users, created]
      return route.fulfill({ json: created })
    }
    if (method === 'DELETE' && id !== null) {
      state.deletedUserId = id
      if (gates.userDelete) await gates.userDelete.promise
      state.users = state.users.filter(u => !(String(u.discord_id) === id && u.list_type === listType))
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ status: 404, json: { detail: 'not found' } })
  })

  await page.route(/\/api\/kick-targets(?:\/([^/?]+))?\/?(?:\?.*)?$/, async route => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const match = url.pathname.match(/^\/api\/kick-targets(?:\/([^/?]+))?\/?$/)
    const id = match?.[1] ?? null

    if (method === 'GET' && id === null) {
      return route.fulfill({ json: state.kickTargets })
    }
    if (method === 'POST' && id === null) {
      const body = await request.postDataJSON()
      state.createdKickPayload = body
      if (gates.kickSave) await gates.kickSave.promise
      const created = { is_active: true, ...body, discord_id: String(body.discord_id) }
      state.kickTargets = [...state.kickTargets, created]
      return route.fulfill({ json: created })
    }
    if (method === 'PATCH' && id !== null) {
      const body = await request.postDataJSON()
      const isToggle = Object.keys(body).length === 1 && 'is_active' in body
      if (isToggle) {
        state.kickToggleCalls += 1
        if (gates.kickToggle) await gates.kickToggle.promise
      } else {
        state.updatedKickPayload = body
        if (gates.kickSave) await gates.kickSave.promise
      }
      state.kickTargets = state.kickTargets.map(t => (String(t.discord_id) === id ? { ...t, ...body } : t))
      return route.fulfill({ json: state.kickTargets.find(t => String(t.discord_id) === id) })
    }
    if (method === 'DELETE' && id !== null) {
      state.deletedKickId = id
      if (gates.kickDelete) await gates.kickDelete.promise
      state.kickTargets = state.kickTargets.filter(t => String(t.discord_id) !== id)
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ status: 404, json: { detail: 'not found' } })
  })

  await page.route(/\/api\/stacking-pairs(?:\/(\d+))?(?:\/(toggle))?\/?(?:\?.*)?$/, async route => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const match = url.pathname.match(/^\/api\/stacking-pairs(?:\/(\d+))?(?:\/(toggle))?\/?$/)
    const id = match?.[1] ? Number(match[1]) : null
    const isToggle = !!match?.[2]

    if (method === 'GET' && id === null) {
      return route.fulfill({ json: state.pairs })
    }
    if (method === 'POST' && id === null) {
      const body = await request.postDataJSON()
      state.createdPairPayload = body
      if (gates.pairSave) await gates.pairSave.promise
      const now = '2026-09-06T12:00:00Z'
      const created = { id: Math.max(0, ...state.pairs.map(p => p.id)) + 1, is_active: true, created_at: now, ...body }
      state.pairs = [...state.pairs, created]
      return route.fulfill({ json: created })
    }
    if (method === 'PATCH' && id !== null && isToggle) {
      state.pairToggleCalls += 1
      if (gates.pairToggle) await gates.pairToggle.promise
      state.pairs = state.pairs.map(p => (p.id === id ? { ...p, is_active: !p.is_active } : p))
      return route.fulfill({ json: state.pairs.find(p => p.id === id) })
    }
    if (method === 'DELETE' && id !== null) {
      state.deletedPairId = id
      if (gates.pairDelete) await gates.pairDelete.promise
      state.pairs = state.pairs.filter(p => p.id !== id)
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ status: 404, json: { detail: 'not found' } })
  })

  return state
}

// Selects a member option in a MemberAutocomplete field identified by its
// visible label: types the target's display name (triggering the
// component's own debounced /api/members search) then clicks the matching
// option once it appears.
async function selectMember(page, label, name) {
  const field = page.getByLabel(label)
  await field.click()
  await field.fill(name)
  await page.getByRole('option', { name }).click()
}

test('users uses semantic tab labels but submits internal list_type values', async ({ page }) => {
  const state = await mockMemberManagement(page, { users: [] })
  await page.goto(`${BASE_URL}/users`)

  await expect(page.getByRole('tab', { name: 'Белый список' })).toBeVisible()
  await page.getByRole('tab', { name: 'Чёрный список' }).click()
  await page.getByRole('button', { name: 'Добавить' }).click()
  await selectMember(page, 'Участник', 'Ada')
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect.poll(() => state.createdUserPayload?.list_type).toBe('blacklist')
  expect(state.createdUserPayload.discord_id).toBe('42')
})

test('users requires selecting a member before saving', async ({ page }) => {
  await mockMemberManagement(page, { users: [] })
  await page.goto(`${BASE_URL}/users`)
  await page.getByRole('button', { name: 'Добавить' }).click()
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByText('Выберите участника')).toBeVisible()
})

test('users keeps its drawer open and disables the submit button while saving', async ({ page }) => {
  const userSave = deferred()
  await mockMemberManagement(page, { users: [], gates: { userSave } })
  await page.goto(`${BASE_URL}/users`)
  await page.getByRole('button', { name: 'Добавить' }).click()
  await selectMember(page, 'Участник', 'Ada')
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByRole('button', { name: 'Сохранение…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Добавить в белый список' })).toBeVisible()
  userSave.resolve()
})

test('users restores focus to the add trigger after the drawer closes', async ({ page }) => {
  await mockMemberManagement(page, { users: [] })
  await page.goto(`${BASE_URL}/users`)
  const addButton = page.getByRole('button', { name: 'Добавить' })
  await addButton.click()
  await page.getByRole('button', { name: 'Отмена' }).click()

  await expect(addButton).toBeFocused()
})

test('users protects a pending destructive confirmation', async ({ page }) => {
  const userDelete = deferred()
  await mockMemberManagement(page, { gates: { userDelete } })
  await page.goto(`${BASE_URL}/users`)
  await page.getByRole('button', { name: 'Удалить: Ada' }).click()
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Удаление…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Удалить участника?' })).toBeVisible()
  userDelete.resolve()
})

test('users has no document overflow at 390x844', async ({ page }) => {
  await mockMemberManagement(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE_URL}/users`)

  await expect(page.getByRole('heading', { name: 'Участники' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('kick targets converts minute-based fields into second-based payload', async ({ page }) => {
  const state = await mockMemberManagement(page, { kickTargets: [] })
  await page.goto(`${BASE_URL}/kick-targets`)
  await page.getByRole('button', { name: 'Добавить' }).click()
  await selectMember(page, 'Участник', 'Ada')
  await page.getByLabel('Минимальное время').fill('10')
  await page.getByLabel('Максимальное время').fill('20')
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect.poll(() => state.createdKickPayload?.timeout_sec).toBe(600)
  expect(state.createdKickPayload.max_timeout_sec).toBe(1200)
})

test('kick targets validates a positive minimum and a maximum not below minimum', async ({ page }) => {
  await mockMemberManagement(page, { kickTargets: [] })
  await page.goto(`${BASE_URL}/kick-targets`)
  await page.getByRole('button', { name: 'Добавить' }).click()
  await selectMember(page, 'Участник', 'Ada')
  await page.getByLabel('Минимальное время').fill('0')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('Минимальное время должно быть больше нуля')).toBeVisible()

  await page.getByLabel('Минимальное время').fill('30')
  await page.getByLabel('Максимальное время').fill('10')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('Максимальное время не может быть меньше минимального')).toBeVisible()
})

test('kick targets shows explicit Включено status text', async ({ page }) => {
  await mockMemberManagement(page, { kickTargets: [kickTargetFixture] })
  await page.goto(`${BASE_URL}/kick-targets`)

  await expect(page.getByText('Включено', { exact: true })).toBeVisible()
})

test('kick targets cannot toggle the same target twice while a toggle is pending', async ({ page }) => {
  const kickToggle = deferred()
  const state = await mockMemberManagement(page, { kickTargets: [kickTargetFixture], gates: { kickToggle } })
  await page.goto(`${BASE_URL}/kick-targets`)

  const toggle = page.getByRole('switch').first()
  await toggle.click()
  await expect(toggle).toBeDisabled()
  await toggle.click({ force: true })

  expect(state.kickToggleCalls).toBe(1)
  kickToggle.resolve()
})

test('kick targets protects a pending destructive confirmation', async ({ page }) => {
  const kickDelete = deferred()
  await mockMemberManagement(page, { kickTargets: [kickTargetFixture], gates: { kickDelete } })
  await page.goto(`${BASE_URL}/kick-targets`)
  await page.getByRole('button', { name: 'Удалить: Ada' }).click()
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Удаление…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Удалить цель кика?' })).toBeVisible()
  kickDelete.resolve()
})

test('kick targets has no document overflow at 390x844', async ({ page }) => {
  await mockMemberManagement(page, { kickTargets: [kickTargetFixture] })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE_URL}/kick-targets`)

  await expect(page.getByRole('heading', { name: 'Кик-цели' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

// FormDrawer's submit button couples its `disabled` state to `submitting`
// (which also swaps its visible label to "Сохранение…") and exposes no
// independent validity-driven disablement — the shared component's locked
// interface (see FormDrawer.jsx) has no such knob. So this asserts the
// behavior that actually matters and is achievable through that interface —
// the adjacent error is visible and clicking Save never reaches the API —
// rather than a literal disabled-attribute check on a button still labelled
// "Сохранить", which the current FormDrawer contract cannot produce.
test('stacking pairs prevents choosing the same member twice', async ({ page }) => {
  const state = await mockMemberManagement(page, { pairs: [] })
  await page.goto(`${BASE_URL}/stacking-pairs`)
  await page.getByRole('button', { name: 'Добавить пару' }).click()
  await selectMember(page, 'Первый участник', 'Ada')
  await selectMember(page, 'Второй участник', 'Ada')
  await expect(page.getByText('Выберите двух разных участников')).toBeVisible()

  await page.getByRole('button', { name: 'Сохранить' }).click()
  expect(state.createdPairPayload).toBeNull()
})

test('stacking pairs creates a pair with two distinct members and a target channel', async ({ page }) => {
  const state = await mockMemberManagement(page, { pairs: [] })
  await page.goto(`${BASE_URL}/stacking-pairs`)
  await page.getByRole('button', { name: 'Добавить пару' }).click()
  await selectMember(page, 'Первый участник', 'Ada')
  await selectMember(page, 'Второй участник', 'Boris')
  await page.getByLabel('Целевой голосовой канал').fill('100')
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect.poll(() => state.createdPairPayload?.target_channel_id).toBe('100')
  expect(state.createdPairPayload.user_id_1).toBe('42')
  expect(state.createdPairPayload.user_id_2).toBe('84')
})

test('stacking pairs cannot toggle the same pair twice while a toggle is pending', async ({ page }) => {
  const pairToggle = deferred()
  const state = await mockMemberManagement(page, { pairs: [stackingPairFixture], gates: { pairToggle } })
  await page.goto(`${BASE_URL}/stacking-pairs`)

  const toggle = page.getByRole('switch').first()
  await toggle.click()
  await expect(toggle).toBeDisabled()
  await toggle.click({ force: true })

  expect(state.pairToggleCalls).toBe(1)
  pairToggle.resolve()
})

test('stacking pairs protects a pending destructive confirmation', async ({ page }) => {
  const pairDelete = deferred()
  await mockMemberManagement(page, { pairs: [stackingPairFixture], gates: { pairDelete } })
  await page.goto(`${BASE_URL}/stacking-pairs`)
  await page.getByRole('button', { name: 'Удалить: пара #4' }).click()
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Удаление…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Удалить пару?' })).toBeVisible()
  pairDelete.resolve()
})

test('stacking pairs has no document overflow at 390x844', async ({ page }) => {
  await mockMemberManagement(page, { pairs: [stackingPairFixture] })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE_URL}/stacking-pairs`)

  await expect(page.getByRole('heading', { name: 'Стаки' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

// ---------------------------------------------------------------------------
// Task 3: schedule management workflow (Schedules)
// ---------------------------------------------------------------------------

// rule_id: 7 deliberately matches the top-level `ruleFixture` (id: 7) defined
// for Task 1 — Schedules resolves rule_id -> rule name/details via the same
// /api/rules list the Rules page reads, so reusing that fixture here is the
// realistic related-rule record rather than a second parallel one.
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

// Mocks the authenticated admin identity, a read-only /api/rules list (used
// only to resolve rule_id -> rule name; Schedules never mutates rules), and
// the full /api/schedules CRUD surface against an in-memory fixture list.
// `gates` optionally defers the create/update ("save") or delete response,
// and/or forces the next non-toggle save to fail with `saveError` so tests
// can assert pending-state UI and inline drawer error handling
// deterministically instead of racing a real network response.
async function mockSchedules(page, {
  schedules = [scheduleFixture],
  rules = [ruleFixture],
  gates = {},
} = {}) {
  const state = {
    schedules: schedules.map(s => ({ ...s })),
    createdPayload: null,
    updatedPayload: null,
    deletedId: null,
    toggleCalls: 0,
  }

  await page.route('**/auth/me', route => route.fulfill({
    json: { id: '1', username: 'Admin', avatar: null },
  }))

  // Read-only: anchored the same way as mockRules' /api/rules route so this
  // only matches the real endpoint and never Vite's dev-server module URL
  // for the source file src/api/rules.js.
  await page.route(/\/api\/rules(?:\/(\d+))?(?:\/(toggle))?\/?(?:\?.*)?$/, async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'GET' && url.pathname === '/api/rules') {
      return route.fulfill({ json: rules })
    }
    return route.fulfill({ status: 404, json: { detail: 'not found' } })
  })

  await page.route(/\/api\/schedules(?:\/(\d+))?\/?(?:\?.*)?$/, async route => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const match = url.pathname.match(/^\/api\/schedules(?:\/(\d+))?\/?$/)
    const id = match?.[1] ? Number(match[1]) : null

    if (method === 'GET' && id === null) {
      return route.fulfill({ json: state.schedules })
    }
    if (method === 'POST' && id === null) {
      const body = await request.postDataJSON()
      state.createdPayload = body
      if (gates.save) await gates.save.promise
      if (gates.saveError) return route.fulfill({ status: 400, json: { detail: gates.saveError } })
      const now = '2026-09-06T12:00:00Z'
      const created = { id: Math.max(0, ...state.schedules.map(s => s.id)) + 1, created_at: now, updated_at: now, ...body }
      state.schedules = [...state.schedules, created]
      return route.fulfill({ json: created })
    }
    if (method === 'PATCH' && id !== null) {
      const body = await request.postDataJSON()
      const isToggle = Object.keys(body).length === 1 && 'is_active' in body
      if (isToggle) {
        state.toggleCalls += 1
        if (gates.toggle) await gates.toggle.promise
      } else {
        state.updatedPayload = body
        if (gates.save) await gates.save.promise
        if (gates.saveError) return route.fulfill({ status: 400, json: { detail: gates.saveError } })
      }
      state.schedules = state.schedules.map(s => (s.id === id ? { ...s, ...body, updated_at: '2026-09-06T12:05:00Z' } : s))
      return route.fulfill({ json: state.schedules.find(s => s.id === id) })
    }
    if (method === 'DELETE' && id !== null) {
      state.deletedId = id
      if (gates.delete) await gates.delete.promise
      state.schedules = state.schedules.filter(s => s.id !== id)
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ status: 404, json: { detail: 'not found' } })
  })

  return state
}

test('schedules resolves the related rule name and uses Russian labels', async ({ page }) => {
  await mockSchedules(page)
  await page.goto(`${BASE_URL}/schedules`)

  await expect(page.getByRole('heading', { name: 'Расписания' })).toBeVisible()
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader', { name: 'Правило' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Cron' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Часовой пояс' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Действие' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Статус' })).toBeVisible()
  await expect(page.getByText(ruleFixture.name)).toBeVisible()
})

test('schedules shows the cron expression in mono with a plain-language preview', async ({ page }) => {
  await mockSchedules(page)
  await page.goto(`${BASE_URL}/schedules`)

  const expectedPreview = cronstrue.toString(scheduleFixture.cron_expr, { locale: 'ru' })
  await expect(page.getByText(scheduleFixture.cron_expr, { exact: true })).toBeVisible()
  await expect(page.getByText(expectedPreview)).toBeVisible()
})

test('schedules shows semantic badge text for the enable action and active status', async ({ page }) => {
  await mockSchedules(page, { schedules: [scheduleFixture] }) // action: 'enable', is_active: true
  await page.goto(`${BASE_URL}/schedules`)

  await expect(page.getByText('Включить правило', { exact: true })).toBeVisible()
  await expect(page.getByText('Активно', { exact: true })).toBeVisible()
})

test('schedules shows semantic badge text for the disable action and inactive status', async ({ page }) => {
  await mockSchedules(page, { schedules: [{ ...scheduleFixture, action: 'disable', is_active: false }] })
  await page.goto(`${BASE_URL}/schedules`)

  await expect(page.getByText('Отключить правило', { exact: true })).toBeVisible()
  await expect(page.getByText('Неактивно', { exact: true })).toBeVisible()
})

test('schedules reports an invalid cron expression beside the cron field', async ({ page }) => {
  const state = await mockSchedules(page, { schedules: [] })
  await page.goto(`${BASE_URL}/schedules`)
  await page.getByRole('button', { name: 'Новое расписание' }).click()
  await page.getByLabel('Правило').click()
  await page.getByRole('option', { name: ruleFixture.name }).click()
  await page.getByLabel('Cron-выражение').fill('не cron')
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByText('Невалидное cron-выражение')).toBeVisible()
  expect(state.createdPayload).toBeNull()
})

test('schedules keeps its drawer open and controls disabled while saving', async ({ page }) => {
  const save = deferred()
  await mockSchedules(page, { gates: { save } })
  await page.goto(`${BASE_URL}/schedules`)
  await page.getByRole('button', { name: 'Редактировать: расписание #3' }).click()
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByRole('button', { name: 'Сохранение…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Редактировать расписание' })).toBeVisible()
  save.resolve()
})

test('schedules shows a request error inside the drawer when saving fails', async ({ page }) => {
  await mockSchedules(page, { gates: { saveError: 'Правило уже занято другим расписанием' } })
  await page.goto(`${BASE_URL}/schedules`)
  await page.getByRole('button', { name: 'Редактировать: расписание #3' }).click()
  await page.getByRole('button', { name: 'Сохранить' }).click()

  const dialog = page.getByRole('dialog', { name: 'Редактировать расписание' })
  await expect(dialog.getByText('Правило уже занято другим расписанием')).toBeVisible()
})

test('schedules protects a pending destructive confirmation', async ({ page }) => {
  const del = deferred()
  await mockSchedules(page, { gates: { delete: del } })
  await page.goto(`${BASE_URL}/schedules`)
  await page.getByRole('button', { name: 'Удалить: расписание #3' }).click()
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Удаление…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Удалить расписание?' })).toBeVisible()
  del.resolve()
})

test('schedules has no document overflow at 390x844', async ({ page }) => {
  await mockSchedules(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE_URL}/schedules`)

  await expect(page.getByRole('heading', { name: 'Расписания' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
