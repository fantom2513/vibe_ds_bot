import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

import { measureBundle, checkBudget } from './check_bundle_size.mjs'

async function makeDist(files) {
  const dir = await mkdtemp(join(tmpdir(), 'bundle-'))
  const assets = join(dir, 'assets')
  await mkdir(assets)
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(assets, name), content)
  }
  return dir
}

test('measureBundle sums gzipped sizes per file type', async () => {
  const js = 'x'.repeat(5000)
  const css = 'y'.repeat(3000)
  const dir = await makeDist({ 'app.js': js, 'app.css': css })

  const result = await measureBundle(dir)

  assert.equal(result.js, gzipSync(Buffer.from(js)).length)
  assert.equal(result.css, gzipSync(Buffer.from(css)).length)
})

test('measureBundle ignores non-asset files such as source maps', async () => {
  const dir = await makeDist({ 'app.js': 'a'.repeat(100), 'app.js.map': 'b'.repeat(90000) })

  const result = await measureBundle(dir)

  assert.equal(result.js, gzipSync(Buffer.from('a'.repeat(100))).length)
})

test('checkBudget passes when every measurement is under budget', () => {
  const outcome = checkBudget({ js: 100, css: 50 }, { js: 200, css: 100 })

  assert.equal(outcome.ok, true)
  assert.equal(outcome.violations.length, 0)
})

test('checkBudget reports every category that is over budget', () => {
  const outcome = checkBudget({ js: 300, css: 150 }, { js: 200, css: 100 })

  assert.equal(outcome.ok, false)
  assert.equal(outcome.violations.length, 2)
  assert.match(outcome.violations[0], /js/)
})

test('checkBudget treats a measurement exactly at budget as passing', () => {
  const outcome = checkBudget({ js: 200 }, { js: 200 })

  assert.equal(outcome.ok, true)
})
