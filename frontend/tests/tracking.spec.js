import { createRequire } from 'node:module'
import { createServer } from 'vite'

const requireFromRunner = createRequire(process.argv[1])
const { test, expect } = requireFromRunner('playwright/test')

// A distinct port from admin-dashboard-redesign.spec.js's dev server: both
// files spin up their own `vite` instance in beforeAll/afterAll, and
// Playwright runs spec files in parallel workers by default, so sharing a
// port lets whichever file finishes first tear down the server the other
// file's still-running tests are navigating against (ERR_CONNECTION_REFUSED).
const BASE_URL = 'http://127.0.0.1:5174'

const memberFixture = {
  id: '42',
  username: 'ada',
  display_name: 'Ada Lovelace',
  label: 'Ada Lovelace',
  avatar: null,
}

const trackedFixture = (overrides = {}) => ({
  discord_id: '42',
  username: 'Ada Lovelace',
  is_active: true,
  work_days: [0, 1, 2, 3, 4],
  work_start: '09:00',
  work_end: '18:00',
  timezone: 'Europe/Moscow',
  created_at: '2026-08-28T09:00:00Z',
  updated_at: '2026-08-28T09:00:00Z',
  ...overrides,
})

let devServer

test.beforeAll(async () => {
  devServer = await createServer({
    server: { host: '127.0.0.1', port: 5174 },
    logLevel: 'error',
  })
  await devServer.listen()
})

test.afterAll(async () => {
  await devServer?.close()
})

test.use({ launchOptions: { channel: 'msedge' } })

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

const reportFixture = (username = 'Ada Lovelace', overrides = {}) => ({
  period_start: '2026-08-28T00:00:00Z',
  period_end: '2026-08-28T12:00:00Z',
  members: [{
    discord_id: '42',
    username,
    total_seconds: 3600,
    session_count: 1,
    work_seconds: 1800,
    ...overrides,
  }],
  overlaps: [],
})

async function mockApp(page, {
  member = memberFixture,
  initialMembers = [],
  gates = {},
  handlers = {},
} = {}) {
  const state = {
    members: [...initialMembers],
    reportChannelId: null,
    createdPayload: null,
  }

  await page.route('**/auth/me', route => route.fulfill({
    json: { id: '1', username: 'Admin', avatar: null },
  }))
  await page.route(/\/api\/members(?:\/(?:42|batch))?(?:\?.*)?$/, route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/members/42') return route.fulfill({ json: member })
    if (path === '/api/members/batch') return route.fulfill({ json: { 42: member } })
    return route.fulfill({ json: [member] })
  })
  await page.route('**/api/tracking/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const key = `${method} ${url.pathname}`

    if (handlers[key]) {
      await handlers[key]({ route, request, url, state })
      return
    }
    if (gates[key]) await gates[key]

    if (url.pathname === '/api/tracking/members' && method === 'GET') {
      return route.fulfill({ json: state.members })
    }
    if (url.pathname === '/api/tracking/members' && method === 'POST') {
      const body = await request.postDataJSON()
      state.createdPayload = body
      const created = trackedFixture({ ...body, username: body.username ?? null })
      state.members = [created]
      return route.fulfill({ json: created })
    }
    if (url.pathname === '/api/tracking/members/42' && method === 'PATCH') {
      state.members = [{ ...state.members[0], ...(await request.postDataJSON()), updated_at: '2026-08-28T10:00:00Z' }]
      return route.fulfill({ json: state.members[0] })
    }
    if (url.pathname === '/api/tracking/members/42' && method === 'DELETE') {
      state.members = []
      return route.fulfill({ status: 204 })
    }
    if (url.pathname === '/api/tracking/settings' && method === 'GET') {
      return route.fulfill({ json: { report_channel_id: state.reportChannelId } })
    }
    if (url.pathname === '/api/tracking/settings' && method === 'PATCH') {
      state.reportChannelId = (await request.postDataJSON()).report_channel_id
      return route.fulfill({ json: { report_channel_id: state.reportChannelId } })
    }
    if (url.pathname === '/api/tracking/text-channels') {
      return route.fulfill({ json: [{ id: '99', name: 'reports' }] })
    }
    if (url.pathname === '/api/tracking/preview') {
      return route.fulfill({ json: {
        ...reportFixture(),
        members: state.members.map(tracked => ({
          discord_id: tracked.discord_id,
          username: tracked.username,
          total_seconds: 3600,
          session_count: 1,
          work_seconds: 1800,
        })),
      } })
    }

    return route.fulfill({ status: 404, json: { detail: 'Unhandled test route' } })
  })

  return state
}

test('adds a Discord member, edits schedule, and saves report channel', async ({ page }) => {
  const state = await mockApp(page)

  await page.goto(`${BASE_URL}/tracking`)
  await page.getByLabel('Пользователь').fill('Ada')
  await page.getByRole('option', { name: /Ada Lovelace/ }).click()
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page.getByLabel('Начало рабочего дня').fill('10:00')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()

  await page.getByLabel('Канал отчётов').click()
  await page.getByRole('option', { name: '#reports' }).click()
  await page.getByRole('button', { name: 'Сохранить канал' }).click()

  await expect(page.getByText('Канал отчётов сохранён')).toBeVisible()
  await expect.poll(() => state.members[0]?.work_start).toBe('10:00')
})

test('persists the selected display name', async ({ page }) => {
  const state = await mockApp(page)

  await page.goto(`${BASE_URL}/tracking`)
  await page.getByLabel('Пользователь').fill('Ada')
  await page.getByRole('option', { name: /Ada Lovelace/ }).click()
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Рабочий график' })).toBeVisible()
  expect(state.createdPayload?.username).toBe('Ada Lovelace')
})

test('reports add progress', async ({ page }) => {
  const addGate = deferred()
  await mockApp(page, { gates: { 'POST /api/tracking/members': addGate.promise } })

  await page.goto(`${BASE_URL}/tracking`)
  await page.getByLabel('Пользователь').fill('Ada')
  await page.getByRole('option', { name: /Ada Lovelace/ }).click()
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()

  try {
    await expect(page.getByRole('button', { name: 'Добавление…' })).toBeDisabled()
  } finally {
    addGate.resolve()
  }

  await expect(page.getByRole('heading', { name: 'Рабочий график' })).toBeVisible()
})

test('keeps administration available when the initial preview fails', async ({ page }) => {
  await mockApp(page, {
    handlers: {
      'GET /api/tracking/preview': ({ route }) => route.fulfill({
        status: 503,
        json: { detail: 'Предпросмотр временно недоступен' },
      }),
    },
  })

  await page.goto(`${BASE_URL}/tracking`)

  await expect(page.getByLabel('Пользователь')).toBeVisible()
  await expect(page.getByLabel('Канал отчётов')).toBeVisible()
  await expect(page.getByText('Предпросмотр временно недоступен')).toBeVisible()
})

test('keeps the newest period result and locale-formats report numbers', async ({ page }) => {
  const releaseWeek = deferred()
  const weekCompleted = deferred()
  await mockApp(page, {
    initialMembers: [trackedFixture()],
    handlers: {
      'GET /api/tracking/preview': async ({ route, url }) => {
        const period = url.searchParams.get('period')
        if (period === 'week') {
          await releaseWeek.promise
          await route.fulfill({ json: reportFixture('Week stale') })
          weekCompleted.resolve()
          return
        }
        if (period === 'month') {
          await route.fulfill({
            json: reportFixture('Month current', {
              total_seconds: 159998400,
              session_count: 12345,
              work_seconds: 15998400,
            }),
          })
          releaseWeek.resolve()
          return
        }
        await route.fulfill({ json: reportFixture('Today') })
      },
    },
  })

  await page.goto(`${BASE_URL}/tracking`)
  await page.getByRole('combobox', { name: 'Период' }).click()
  await page.getByRole('option', { name: 'Неделя' }).click()
  await page.getByRole('combobox', { name: 'Период' }).click()
  await page.getByRole('option', { name: 'Месяц' }).click()
  await weekCompleted.promise

  const personalTable = page.getByRole('table', { name: 'Личная статистика' })
  await expect(personalTable).toContainText('Month current')
  await expect(personalTable).not.toContainText('Week stale')
  await expect(personalTable).toContainText(/44[\s\u00a0]444 ч/)
  await expect(personalTable).toContainText(/12[\s\u00a0]345/)
})

test('refreshes a completed schedule save with the currently selected period', async ({ page }) => {
  const scheduleGate = deferred()
  await mockApp(page, {
    initialMembers: [trackedFixture()],
    gates: { 'PATCH /api/tracking/members/42': scheduleGate.promise },
    handlers: {
      'GET /api/tracking/preview': ({ route, url }) => {
        const selectedPeriod = url.searchParams.get('period')
        return route.fulfill({
          json: reportFixture(selectedPeriod === 'month' ? 'Month current' : 'Today stale'),
        })
      },
    },
  })

  await page.goto(`${BASE_URL}/tracking`)
  await page.getByRole('button', { name: 'Редактировать график: Ada Lovelace' }).click()
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()

  await page.locator('input.MuiSelect-nativeInput[value="today"]').evaluate(input => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    valueSetter.call(input, 'month')
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(page.locator('table[aria-label="Личная статистика"]')).toContainText('Month current')

  scheduleGate.resolve()
  await expect(page.getByText('Расписание сохранено')).toBeVisible()

  const personalTable = page.getByRole('table', { name: 'Личная статистика' })
  await expect(page.getByRole('combobox', { name: 'Период' })).toContainText('Месяц')
  await expect(personalTable).toContainText('Month current')
  await expect(personalTable).not.toContainText('Today stale')
})

test('mobile schedule drawer exposes cancel and protects a pending save', async ({ page }) => {
  const longName = 'Ada Lovelace — руководитель очень длинного исследовательского направления'
  const longMember = { ...memberFixture, display_name: longName, label: longName }
  const scheduleGate = deferred()
  await page.setViewportSize({ width: 360, height: 800 })
  await mockApp(page, {
    member: longMember,
    initialMembers: [trackedFixture({ username: longName })],
    gates: { 'PATCH /api/tracking/members/42': scheduleGate.promise },
  })

  await page.goto(`${BASE_URL}/tracking`)
  await page.getByRole('button', { name: `Редактировать график: ${longName}` }).click()

  const cancel = page.getByRole('button', { name: 'Отмена', exact: true })
  const save = page.getByRole('button', { name: 'Сохранить', exact: true })
  await expect(cancel).toBeVisible()
  await expect(save).toBeVisible()
  await expect.poll(async () => {
    const saveBox = await save.boundingBox()
    return saveBox.x + saveBox.width
  }).toBeLessThanOrEqual(360)
  await expect(page.getByText(longName).last()).toBeVisible()

  await page.getByLabel('Начало рабочего дня').fill('10:00')
  await cancel.click()
  await expect(page.getByRole('heading', { name: 'Рабочий график' })).toBeHidden()

  await page.getByRole('button', { name: `Редактировать график: ${longName}` }).click()
  await expect(page.getByLabel('Начало рабочего дня')).toHaveValue('09:00')
  await page.getByLabel('Начало рабочего дня').fill('10:00')
  await save.click()

  try {
    await expect(page.getByRole('button', { name: 'Сохранение…' })).toBeDisabled()
    await expect(cancel).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Рабочий график' })).toBeVisible()
  } finally {
    scheduleGate.resolve()
  }

  await expect(page.getByRole('heading', { name: 'Рабочий график' })).toBeHidden()
})

test('reports channel-save progress', async ({ page }) => {
  const channelGate = deferred()
  await mockApp(page, { gates: { 'PATCH /api/tracking/settings': channelGate.promise } })

  await page.goto(`${BASE_URL}/tracking`)
  await page.getByLabel('Канал отчётов').click()
  await page.getByRole('option', { name: '#reports' }).click()
  await page.getByRole('button', { name: 'Сохранить канал' }).click()

  try {
    await expect(page.getByRole('button', { name: 'Сохранение…' })).toBeDisabled()
  } finally {
    channelGate.resolve()
  }

  await expect(page.getByText('Канал отчётов сохранён')).toBeVisible()
})

test('reports delete progress and keeps the pending dialog open', async ({ page }) => {
  const deleteGate = deferred()
  await mockApp(page, {
    initialMembers: [trackedFixture()],
    gates: { 'DELETE /api/tracking/members/42': deleteGate.promise },
  })

  await page.goto(`${BASE_URL}/tracking`)
  await page.getByRole('button', { name: 'Удалить: Ada Lovelace' }).click()
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Удалить участника?' })
  try {
    await expect(page.getByRole('button', { name: 'Удаление…' })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
  } finally {
    deleteGate.resolve()
  }

  await expect(dialog).toBeHidden()
})

test('uses a typographic ellipsis while configuration loads', async ({ page }) => {
  const membersGate = deferred()
  await mockApp(page, { gates: { 'GET /api/tracking/members': membersGate.promise } })

  await page.goto(`${BASE_URL}/tracking`)
  try {
    await expect(page.getByText('Загрузка настроек отслеживания…')).toBeVisible()
  } finally {
    membersGate.resolve()
  }
})
