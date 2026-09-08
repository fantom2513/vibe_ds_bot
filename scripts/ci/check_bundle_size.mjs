#!/usr/bin/env node
/**
 * Бюджет размера фронтового бандла.
 *
 * Меряем gzip, а не сырой размер: пользователь получает бандл сжатым,
 * и именно эта цифра определяет время загрузки. Разница между сырым и
 * gzip для JS — обычно в три-четыре раза, так что бюджет по сырому
 * размеру измерял бы не то.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

// .map намеренно не считаем: source maps не доезжают до пользователя.
const COUNTED = new Set(['.js', '.css'])

export async function measureBundle(distDir) {
  const assetsDir = join(distDir, 'assets')
  const entries = await readdir(assetsDir)
  const totals = { js: 0, css: 0 }

  for (const name of entries) {
    const ext = extname(name)
    if (!COUNTED.has(ext)) continue
    const content = await readFile(join(assetsDir, name))
    totals[ext.slice(1)] += gzipSync(content).length
  }

  return totals
}

export function checkBudget(measured, budget) {
  const violations = []

  for (const [category, limit] of Object.entries(budget)) {
    // Пропускаем нечисловые значения: в bundle-budget.json лежит ключ
    // _comment с пояснением. Без этой строчки он всё равно не срабатывал бы,
    // но только из-за приведения типов в `>`, а опираться на такое не стоит.
    if (typeof limit !== 'number') continue

    const actual = measured[category] ?? 0
    if (actual > limit) {
      violations.push(
        `${category}: ${(actual / 1024).toFixed(1)} KB gzipped exceeds budget of ${(limit / 1024).toFixed(1)} KB`
      )
    }
  }

  return { ok: violations.length === 0, violations }
}

async function main() {
  const [distDir, budgetPath] = process.argv.slice(2)
  if (!distDir || !budgetPath) {
    console.error('usage: check_bundle_size.mjs <dist-dir> <budget.json>')
    process.exit(2)
  }

  const budget = JSON.parse(await readFile(budgetPath, 'utf8'))
  const measured = await measureBundle(distDir)
  const { ok, violations } = checkBudget(measured, budget)

  for (const [category, bytes] of Object.entries(measured)) {
    const limit = budget[category]
    console.log(
      `${category}: ${(bytes / 1024).toFixed(1)} KB gzipped` +
        (limit ? ` (budget ${(limit / 1024).toFixed(1)} KB)` : '')
    )
  }

  if (!ok) {
    for (const violation of violations) console.error(`::error::${violation}`)
    process.exit(1)
  }
}

// Запускаем main только при прямом вызове, чтобы импорт из теста не дёргал
// process.exit. pathToFileURL, а не сравнение строк путей: на Windows
// import.meta.url — это file:///D:/..., а process.argv[1] — D:\..., и
// наивное сравнение здесь всегда ложно.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
