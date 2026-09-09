import { test, expect } from '@playwright/test'
import { createServer } from 'vite'

const BASE_URL = 'http://127.0.0.1:5176'
const LANDING_URL = `${BASE_URL}/landing/index.html`

let devServer

test.beforeAll(async () => {
  devServer = await createServer({
    server: { host: '127.0.0.1', port: 5176 },
    logLevel: 'error',
  })
  await devServer.listen()
})

test.afterAll(async () => {
  await devServer?.close()
})

test('ships the standalone landing with local assets', async ({ page }) => {
  await page.goto(LANDING_URL)

  await expect(page).toHaveTitle(/Vibe/)
  await expect(
    page.getByRole('heading', { name: 'Тишина — тоже состояние системы.' })
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Админка' })).toHaveAttribute('href', '/admin')
})

test('ships root-relative in-page anchors in the standalone landing artifact', async ({ page }) => {
  // nginx serves this file at bare "/" in production, while the <base>
  // keeps fonts/scripts/images scoped to /landing/. Fragment-only links would
  // inherit that base path, so the artifact must use root-relative anchors.
  await page.goto(LANDING_URL)

  await expect(page.getByRole('link', { name: 'Vibe, наверх' })).toHaveAttribute('href', '/#top')
  await expect(page.getByRole('link', { name: 'Интерфейс' })).toHaveAttribute('href', '/#interface')
  await expect(page.getByRole('link', { name: 'Устройство' })).toHaveAttribute('href', '/#system')
  await expect(page.getByRole('link', { name: 'Исходный код', exact: true })).toHaveAttribute(
    'href',
    '/#source'
  )
  await expect(page.getByRole('link', { name: 'Увидеть систему' })).toHaveAttribute(
    'href',
    '/#interface'
  )
  await expect(page.getByRole('link', { name: 'О проекте' })).toHaveAttribute('href', '/#source')
})
