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

test('ships the standalone landing with local assets', async ({ page }) => {
  await page.goto(`${BASE_URL}/landing/`)

  await expect(page).toHaveTitle(/Vibe/)
  await expect(
    page.getByRole('heading', { name: 'Тишина — тоже состояние системы.' })
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Админка' })).toHaveAttribute('href', '/admin')
})

test('keeps in-page anchors on the canonical root instead of the <base href> path', async ({
  page,
}) => {
  // nginx serves this same file at bare "/" (the canonical public URL) via an
  // internal rewrite, while <base href="/landing/"> keeps fonts/scripts/images
  // scoped to their real folder. A bare href="#section" resolves against that
  // base, not the page's actual URL — per URL resolution rules a fragment-only
  // reference inherits the *base's* path, so on "/" it would jump to
  // "/landing/#section" instead of staying on "/". Root-relative hrefs
  // ("/#section") carry their own path and aren't affected by <base>.
  await page.goto(`${BASE_URL}/landing/`)

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
