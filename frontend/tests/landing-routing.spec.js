import { test, expect } from '@playwright/test'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'

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

test('keeps the hero asset decorative and exposes mobile in-page navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE_URL}/`)

  await expect(page.getByRole('link', { name: 'Интерфейс' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Устройство' })).toBeVisible()
  await expect(page.locator('img[src="/landing/singularity-core-v3.png"]')).toHaveAttribute('alt', '')
  expect(await page.locator('html').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
})

test('presents the product proof as a three-step scroll narrative', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE_URL}/`)

  await expect(page.getByRole('heading', { name: 'Состояние сервера' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Логика правила' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Проверяемый результат' })).toBeVisible()
  await expect(page.locator('.landing-story__copy')).toHaveCount(1)
  await expect(page.locator('.landing-story__card')).toHaveCount(3)
})

test('labels the server-state card as representative data rather than live runtime status', async ({ page }) => {
  await page.goto(`${BASE_URL}/`)

  await expect(page.getByText('Пример данных')).toBeVisible()
  await expect(page.getByText('Участники online')).toHaveCount(0)
})

test('keeps the story copy sticky on wide screens and static on mobile', async () => {
  const css = await readFile(new URL('../src/pages/Landing.css', import.meta.url), 'utf8')

  expect(css).toMatch(
    /@media\s*\(min-width:\s*641px\)[\s\S]*?\.landing-story__grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(260px,\s*\.58fr\)\s+minmax\(0,\s*1fr\)/
  )
  expect(css).toMatch(
    /@media\s*\(min-width:\s*641px\)[\s\S]*?\.landing-story__copy\s*\{[\s\S]*?align-self:\s*start;[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*7rem/
  )
  expect(css).toMatch(
    /@media\s*\(max-width:\s*640px\)[\s\S]*?\.landing-story__copy\s*\{[\s\S]*?position:\s*static/
  )
})
