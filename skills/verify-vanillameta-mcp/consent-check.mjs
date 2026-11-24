#!/usr/bin/env node
// Opens the AI connection consent screen in a real browser and checks which permissions are preselected.
// It only observes. It never approves, so it creates no grant.
// Env: WEB, API (with /v1), VM_USER, VM_PASSWORD, SHOTS (screenshot directory).
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const { chromium } = createRequire(join(root, 'frontend-web', 'package.json'))('playwright');

const web = (process.env.WEB ?? 'http://localhost:3000').replace(/\/$/, '');
const api = (process.env.API ?? 'http://localhost:4000/v1').replace(/\/$/, '');
const shots = process.env.SHOTS ?? join(root, '.verify', 'consent');
mkdirSync(shots, { recursive: true });

let failed = 0;
const report = (ok, message) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${message}`);
};

const verifier = randomBytes(48).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const query = new URLSearchParams({
  response_type: 'code',
  client_id: 'claude-code',
  redirect_uri: 'http://localhost:53683/callback',
  code_challenge: challenge,
  code_challenge_method: 'S256',
  state: randomBytes(16).toString('hex'),
  scope: 'artifacts:read artifacts:write',
  resource: `${api}/mcp`,
});

const browser = await chromium.launch().catch(error => {
  console.log(`FAIL: cannot start the browser (cd frontend-web && npx playwright install chromium): ${error.message.split('\n')[0]}`);
  process.exit(1);
});
try {
  const page = await (await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(`${web}/login`);
  await page.fill('input[name="userId"]', process.env.VM_USER ?? 'guest');
  await page.fill('input[name="userPwd"]', process.env.VM_PASSWORD ?? 'Admin!@12');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 });

  await page.goto(`${api}/mcp-oauth/authorize?${query}`);
  const fieldset = page.locator('fieldset', { has: page.locator('legend', { hasText: 'Permissions' }) });
  await fieldset.waitFor({ timeout: 15_000 });
  const read = fieldset.getByLabel('Read my artifacts');
  const write = fieldset.getByLabel('Create, update and delete my artifacts');
  report(await read.isChecked(), 'the read permission is preselected');
  report(!(await write.isChecked()), 'the write permission is not preselected');
  report(await fieldset.getByText('Write access is off by default').isVisible(), 'the opt-in hint is visible');
  await page.screenshot({ path: join(shots, 'consent-default.png'), fullPage: true });

  await write.check();
  report(await write.isChecked(), 'the write permission can be ticked by the user');
  await page.screenshot({ path: join(shots, 'consent-write-ticked.png'), fullPage: true });
} catch (error) {
  report(false, `consent screen did not load: ${error.message.split('\n')[0]}`);
} finally {
  await browser.close();
}
process.exit(failed === 0 ? 0 : 1);
