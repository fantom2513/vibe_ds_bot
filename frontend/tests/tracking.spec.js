import { createRequire } from 'node:module'
import { createServer } from 'vite'

const requireFromRunner = createRequire(process.argv[1])
const { test, expect } = requireFromRunner('playwright/test')

const BASE_URL = 'http://127.0.0.1:5173'

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
    server: { host: '127.0.0.1', port: 5173 },
    logLevel: 'error',
  })
  await devServer.listen()
})

test.afterAll(async () => {
  await devServer?.close()
})

test.use({ launchOptions: { channel: 'msedge' } })

test('adds a Discord member, edits schedule, and saves report channel', async ({ page }) => {
  let members = []
  let reportChannelId = null

  await page.route('**/auth/me', route => route.fulfill({
    json: { id: '1', username: 'Admin', avatar: null },
  }))
  await page.route(/\/api\/members(?:\/(?:42|batch))?(?:\?.*)?$/, route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/members/42') return route.fulfill({ json: memberFixture })
    if (path === '/api/members/batch') return route.fulfill({ json: { 42: memberFixture } })
    return route.fulfill({ json: [memberFixture] })
  })
  await page.route('**/api/tracking/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (url.pathname === '/api/tracking/members' && method === 'GET') {
      return route.fulfill({ json: members })
    }
    if (url.pathname === '/api/tracking/members' && method === 'POST') {
      const created = trackedFixture(await request.postDataJSON())
      members = [created]
      return route.fulfill({ json: created })
    }
    if (url.pathname === '/api/tracking/members/42' && method === 'PATCH') {
      members = [{ ...members[0], ...(await request.postDataJSON()), updated_at: '2026-08-28T10:00:00Z' }]
      return route.fulfill({ json: members[0] })
    }
    if (url.pathname === '/api/tracking/settings' && method === 'GET') {
      return route.fulfill({ json: { report_channel_id: reportChannelId } })
    }
    if (url.pathname === '/api/tracking/settings' && method === 'PATCH') {
      reportChannelId = (await request.postDataJSON()).report_channel_id
      return route.fulfill({ json: { report_channel_id: reportChannelId } })
    }
    if (url.pathname === '/api/tracking/text-channels') {
      return route.fulfill({ json: [{ id: '99', name: 'reports' }] })
    }
    if (url.pathname === '/api/tracking/preview') {
      return route.fulfill({
        json: {
          period_start: '2026-08-28T00:00:00Z',
          period_end: '2026-08-28T12:00:00Z',
          members: members.map(member => ({
            discord_id: member.discord_id,
            username: member.username,
            total_seconds: 3600,
            session_count: 1,
            work_seconds: 1800,
          })),
          overlaps: [],
        },
      })
    }

    return route.fulfill({ status: 404, json: { detail: 'Unhandled test route' } })
  })

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
  await expect.poll(() => members[0]?.work_start).toBe('10:00')
})
