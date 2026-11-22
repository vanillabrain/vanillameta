#!/usr/bin/env node
// Record only the public guide in a fresh browser context.
const { chromium } = require('node:module').createRequire(require.resolve('../../../frontend-web/package.json'))('@playwright/test')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const assert = require('node:assert/strict')

async function run() {
  const [site, destination] = process.argv.slice(2)
  if (!destination) throw new Error('Usage: record-first-chart.cjs SITE NEW_EVIDENCE_DIRECTORY')
  const out = path.resolve(destination)
  await fs.mkdir(path.dirname(out), { recursive: true })
  await fs.mkdir(out) // Preserve previous runs, including failures.
  const browser = await chromium.launch()
  const viewport = { width: 1440, height: 900 }
  const results = { site, started: new Date().toISOString(), images: [], passed: false }
  try {
    const context = await browser.newContext({ viewport, recordVideo: { dir: out, size: viewport } })
    const page = await context.newPage()
    const shot = name => page.screenshot({ path: path.join(out, name + '.png') })
    try {
      const contents = await page.goto(new URL('contents', site).href)
      assert.equal(contents.status(), 200)
      const entry = page.locator('.vp-doc').getByRole('link', { name: /Codex로 첫 차트 만들기/ }).first()
      await entry.scrollIntoViewIfNeeded()
      await entry.focus()
      await shot('01-contents')
      await page.waitForTimeout(1200) // Reading time in the recording.
      await entry.click()
      await page.getByRole('heading', { level: 1, name: 'Codex로 첫 차트 만들기' }).waitFor()
      assert.match(new URL(page.url()).pathname, /\/codex-first-chart(?:\.html)?\/?$/)
      results.tutorial = page.url()
      await shot('02-tutorial')
      await page.waitForTimeout(1500)
      for (const [index, name] of ['first-chart-consent', 'first-chart-updated'].entries()) {
        const image = page.locator('.vp-doc img').filter({ visible: true }).nth(index)
        await image.scrollIntoViewIfNeeded()
        const info = await image.evaluate(async element => {
          await element.decode()
          return { url: element.currentSrc, alt: element.alt, width: element.naturalWidth, height: element.naturalHeight }
        })
        const response = await context.request.get(info.url)
        assert.equal(response.status(), 200)
        assert.match(response.headers()['content-type'], /^image\/png/)
        const hash = bytes => createHash('sha256').update(bytes).digest('hex')
        const original = await fs.readFile(path.resolve(__dirname, '../../../docs/user-manual/images', name + '.png'))
        const sha256 = hash(await response.body())
        assert.equal(sha256, hash(original))
        assert.ok(info.width && info.height)
        await shot('0' + (index + 3) + '-' + name)
        results.images.push({ ...info, sha256, status: response.status() })
        await page.waitForTimeout(2000)
      }
      results.passed = true
    } catch (error) {
      results.error = error.message
      throw error
    } finally {
      await context.close()
      await fs.rename(await page.video().path(), path.join(out, 'guide-flow.webm'))
    }
  } finally {
    await browser.close()
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(results, null, 2) + '\n')
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1 })
