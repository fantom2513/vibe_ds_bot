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

test('renders the public React landing at root while retaining the admin login', async ({
  page,
}) => {
  await page.goto(`${BASE_URL}/`)

  await expect(page).toHaveTitle(/Vibe/)
  await expect(
    page.getByRole('heading', { name: 'Тишина — тоже состояние системы.' })
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Открыть админку' })).toHaveAttribute(
    'href',
    '/admin'
  )

  await page.goto(`${BASE_URL}/admin/login`)
  await expect(page.getByRole('heading', { name: 'Bot Dashboard' })).toBeVisible()
})

test('links the public landing nav anchors to their in-page sections', async ({ page }) => {
  await page.goto(`${BASE_URL}/`)

  await expect(page.getByRole('link', { name: 'Интерфейс' })).toHaveAttribute('href', '#interface')
  await expect(page.getByRole('link', { name: 'Устройство' })).toHaveAttribute('href', '#source')
  await expect(page.getByRole('link', { name: 'Исходный код', exact: true })).toHaveAttribute(
    'href',
    '#source'
  )
  await expect(page.locator('#interface')).toHaveCount(1)
  await expect(page.locator('#source')).toHaveCount(1)
})

test('keeps the hero asset decorative and exposes mobile in-page navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE_URL}/`)

  await expect(page.getByRole('link', { name: 'Интерфейс' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Устройство' })).toBeVisible()
  await expect(page.locator('img[src="/landing/singularity-core-v3.png"]')).toHaveAttribute(
    'alt',
    ''
  )
  expect(await page.locator('html').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(
    true
  )
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

test('labels the server-state card as representative data rather than live runtime status', async ({
  page,
}) => {
  await page.goto(`${BASE_URL}/`)

  await expect(page.getByText('Пример данных')).toBeVisible()
  await expect(page.getByText('Участники online')).toHaveCount(0)
})

test('keeps the story copy sticky on wide screens and static on mobile', async () => {
  const css = await readFile(new URL('../src/pages/Landing.css', import.meta.url), 'utf8')

  expect(css).toMatch(
    /@media\s*\(min-width:\s*641px\)[\s\S]*?\.landing-story__grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(260px,\s*0?\.58fr\)\s+minmax\(0,\s*1fr\)/
  )
  expect(css).toMatch(
    /@media\s*\(min-width:\s*641px\)[\s\S]*?\.landing-story__copy\s*\{[\s\S]*?align-self:\s*start;[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*7rem/
  )
  expect(css).toMatch(
    /@media\s*\(max-width:\s*640px\)[\s\S]*?\.landing-story__copy\s*\{[\s\S]*?position:\s*static/
  )
})

test('shows the project technology contour without fabricated runtime metrics', async ({
  page,
}) => {
  await page.goto(`${BASE_URL}/`)

  for (const name of [
    'React',
    'FastAPI',
    'PostgreSQL',
    'discord.py',
    'Docker',
    'Nginx',
    'GitHub Actions',
  ]) {
    await expect(page.getByRole('listitem', { name })).toBeVisible()
  }
  await expect(page.getByText('GitHub Actions → Docker → Nginx → production')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Открыть workflow' })).toHaveAttribute(
    'href',
    'https://github.com/fantom2513/vibe_ds_bot/actions'
  )
  await expect(page.getByRole('link', { name: 'Открыть workflow' })).toHaveAttribute(
    'target',
    '_blank'
  )
  await expect(page.getByText(/99\.9%|42 ms|Production active/)).toHaveCount(0)
})

test('routes the React entry at root and declares reduced-motion delivery styles', async () => {
  const [nginx, css] = await Promise.all([
    readFile(new URL('../nginx.conf', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Landing.css', import.meta.url), 'utf8'),
  ])

  const rootLocation = nginx.match(/location\s*=\s*\/\s*\{([\s\S]*?)^\s*}/m)
  const adminLocation = nginx.match(/location\s*=\s*\/admin\s*\{([\s\S]*?)^\s*}/m)

  expect(rootLocation?.[1]).toMatch(/^\s*try_files\s+\/index\.html\s+=404;/m)
  expect(rootLocation?.[1]).not.toContain('/landing/index.html')
  expect(adminLocation?.[1]).toMatch(/^\s*try_files\s+\/index\.html\s+=404;/m)
  expect(css).toMatch(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.landing\s*\{[\s\S]*?animation:\s*none(?:\s*!important)?;[\s\S]*?scroll-behavior:\s*auto;[\s\S]*?transition:\s*none(?:\s*!important)?;/
  )
  expect(css).toMatch(
    /\.landing\s+#interface,[\s\S]*?\.landing\s+#source\s*\{[\s\S]*?scroll-margin-top:/
  )
})

test('keeps the landing readable when motion is reduced', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${BASE_URL}/`)

  await expect(
    page.getByRole('heading', { name: 'Тишина — тоже состояние системы.' })
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Посмотреть систему' })).toBeVisible()
})
