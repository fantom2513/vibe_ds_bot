import { test, expect } from '@playwright/test'
import { createServer } from 'vite'

const BASE_URL = 'http://127.0.0.1:5176'

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

test('renders the public React landing at root while retaining the admin login', async ({ page }) => {
  await page.goto(`${BASE_URL}/`)

  await expect(page).toHaveTitle(/Vibe/)
  await expect(page.getByRole('heading', { name: 'Тишина — тоже состояние системы.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Открыть админку' })).toHaveAttribute('href', '/admin')

  await page.goto(`${BASE_URL}/admin/login`)
  await expect(page.getByRole('heading', { name: 'Bot Dashboard' })).toBeVisible()
})

test('links the public landing nav anchors to their in-page sections', async ({ page }) => {
  await page.goto(`${BASE_URL}/`)

  await expect(page.getByRole('link', { name: 'Интерфейс' })).toHaveAttribute('href', '#interface')
  await expect(page.getByRole('link', { name: 'Устройство' })).toHaveAttribute('href', '#system')
  await expect(page.getByRole('link', { name: 'Исходный код', exact: true })).toHaveAttribute(
    'href',
    '#source'
  )
})
