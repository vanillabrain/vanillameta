import { expect, Locator, Page, request, Response, TestInfo, test as baseTest } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import { API, Actor, BASE, GOLD, RECORDS, body, call, ok, paced, unique } from './helpers';

export const test = baseTest.extend<{ browserHealth: void }>({
  browserHealth: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]')));
    await use();
    expect(errors, 'uncaught browser exceptions').toEqual([]);
  }, { auto: true }],
});

export async function uiActor(): Promise<Actor> {
  const userId = `qa${randomBytes(5).toString('hex')}`;
  const password = `Qa1!${randomBytes(6).toString('hex')}`;
  const email = `${userId}@example.test`;
  const context = await request.newContext({ timeout: 5000 });
  await paced();
  expect((await context.post(`${API}/login/signup`, { data: { userId, password, email } })).status()).toBe(201);
  await paced();
  const response = await context.post(`${API}/login/signin`, { data: { userId, password } });
  expect(response.status()).toBe(201);
  const result = await body(response);
  expect(typeof result.accessToken).toBe('string');
  const user = { userId, password, email, token: result.accessToken, context, base: API };
  await expect.poll(async () => (await ok(await call(user, 'GET', '/dashboard'))).length).toBeGreaterThan(0);
  return user;
}

export async function language(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('i18nextLng')) localStorage.setItem('i18nextLng', 'en');
  });
}

export const saveButton = (page: Page) => page.getByRole('button', { name: 'Save', exact: true }).last();
export const dialog = (page: Page) => page.locator('[role="dialog"][aria-describedby="alert-dialog-slide-description"]');
export const errorSurface = (page: Page) => page.locator('.MuiAlert-standardError, #alert-dialog-slide-description');

export async function feedback(page: Page, text: string | RegExp) {
  await expect(errorSurface(page).filter({ hasText: text }).last()).toBeVisible();
}

export async function confirm(page: Page, accept = true) {
  const box = dialog(page);
  await expect(box).toBeVisible();
  const buttons = box.locator('.MuiDialogActions-root button');
  await (accept ? buttons.first() : buttons.last()).click();
  await expect(box).toHaveCount(0);
}

export async function closeError(page: Page) {
  await dialog(page).locator('.MuiDialogActions-root button').last().click();
  await expect(dialog(page)).toHaveCount(0);
}

export function visualCombobox(page: Page, label: string, scope: Page | Locator = page) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const visualLabel = page.locator('.MuiInputLabel-root').filter({ hasText: new RegExp(`^${escaped}(?:\\s*\\*)?\\s*$`) });
  return scope.locator('.MuiFormControl-root:visible').filter({ has: visualLabel }).getByRole('combobox');
}

export async function select(page: Page, target: Locator, value: string) {
  await expect(target).toHaveCount(1);
  await expect(target).toBeVisible();
  await target.click();
  await page.getByRole('option', { name: value, exact: true }).click();
  await expect(target).toContainText(value);
}

export async function selectSqliteType(page: Page) {
  const typeList = page.getByText('step.01 Type', { exact: true }).locator('xpath=..').locator(':scope > ul');
  await expect(typeList).toHaveCount(1);
  const title = typeList.locator(':scope > li > .MuiCard-root > .MuiCardContent-root').getByText('SQLite', { exact: true });
  await expect(title).toHaveCount(1);
  await expect(title).toBeVisible();
  await title.click();
}

export async function ace(page: Page, sql: string) {
  await expect(page.locator('#codeInput')).toBeVisible();
  await page.locator('.ace_text-input').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(sql);
  await expect.poll(() => aceValue(page)).toBe(sql);
}

export async function aceValue(page: Page) {
  return page.locator('#codeInput').evaluate((element: any) => element.env.editor.getValue());
}

export async function runDataset(page: Page, sql = GOLD.aggregateSql) {
  await ace(page, sql);
  const pending = page.waitForResponse(r => r.url().endsWith('/database/execute') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.status).toBe('SUCCESS');
  if (sql === GOLD.aggregateSql) {
    expect(result.datas).toEqual([{ total: GOLD.sumAmount }]);
    await gridCell(page, 'total', String(GOLD.sumAmount));
  }
  return result;
}

export async function gridCell(page: Page, column: string, value: string, row = 0) {
  await expect(page.locator(`.tui-grid-body-area [data-row-key="${row}"][data-column-name="${column}"] .tui-grid-cell-content`).first()).toHaveText(value);
}

export async function oracleGrid(page: Page) {
  await expect(page.locator('.tui-grid-container')).toBeVisible();
  for (const [index, row] of RECORDS.entries()) {
    for (const [column, value] of Object.entries(row)) await gridCell(page, column, String(value), index);
  }
  await expect(page.locator('.tui-grid-body-area [data-column-name="id"][data-row-key]')).toHaveCount(GOLD.rowCount);
  for (const column of Object.keys(RECORDS[0])) await expect(page.locator(`.tui-grid-header-area [data-column-name="${column}"]`).first()).toBeVisible();
}

export async function filePage(page: Page) {
  await page.goto('/data/file');
  await expect(page.getByRole('button', { name: 'Choose file', exact: true })).toBeEnabled({ timeout: 60000 });
}

export async function browserFile(page: Page, name = `${unique()}.csv`, buffer = Buffer.from(GOLD.salesCsv)) {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
  await page.getByRole('button', { name: /^(브라우저에서 분석|Analyze in browser)$/ }).click();
  await expect(page.getByText(`${name} →`, { exact: false })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Choose file', exact: true })).toBeEnabled();
}

export async function fileQuery(page: Page, sql: string) {
  await page.locator('input[placeholder^="Enter SQL"]').fill(sql);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const chooseFile = page.locator('button').filter({ hasText: /^Choose file$/ });
  await expect(chooseFile).toHaveCount(1);
  await expect(chooseFile).toBeEnabled();
}

export async function downloadCsv(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const downloaded = await pending;
  expect(await downloaded.failure()).toBeNull();
  const filename = await downloaded.path();
  expect(filename).toBeTruthy();
  return fs.readFile(filename!, 'utf8');
}

export function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(field); field = ''; }
    else if (character === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += character;
  }
  expect(quoted, 'CSV quotes must be balanced').toBe(false);
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function inventory(owner: Actor, resource: string) {
  const response = await call(owner, 'GET', `/${resource}`);
  expect(response.ok()).toBe(true);
  const list = resource === 'dataset' ? await body(response) : await ok(response);
  expect(Array.isArray(list)).toBe(true);
  return list;
}

export async function persisted(owner: Actor, resource: string, id: number) {
  return ok(await call(owner, 'GET', `/${resource}/${id}`));
}

export async function savedResponse(response: Response) {
  expect(response.ok()).toBe(true);
  const value = await response.json();
  expect(value.status).toBe('SUCCESS');
  return value.data;
}

export async function numericView(page: Page, title: string) {
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await expect(page.locator('.MuiCard-root').getByText(String(GOLD.sumAmount), { exact: true }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/Failed to load the widget|componentNotSelected|failedWidget|컴포넌트를 선택/);
}

export async function addWidget(page: Page, title: string) {
  await page.getByRole('button', { name: 'Add widget', exact: true }).first().click();
  const popup = page.locator('[role="dialog"]').filter({ has: page.locator('.MuiListItemButton-root') });
  await popup.locator('.MuiListItemButton-root').filter({ hasText: title }).click();
  await popup.locator('.MuiDialogActions-root button').last().click();
  await expect(popup).toHaveCount(0);
  await numericView(page, title);
}

export async function boardItem(page: Page, resource: 'widget' | 'dashboard', id: number) {
  const item = page.locator(`a.MuiListItem-root[href="/${resource}/${id}"]`);
  await expect(page.locator('.MuiPagination-root')).toBeVisible();
  const visited = new Set<string>();
  while (!(await item.isVisible())) {
    const selected = await page.locator('.MuiPaginationItem-root.Mui-selected').innerText();
    expect(visited.has(selected), 'listing pagination cannot loop').toBe(false);
    visited.add(selected);
    const next = page.getByRole('button', { name: 'Go to next page' });
    await expect(next, 'owned item must exist on an actual list page').toBeEnabled();
    await next.click();
    await expect(page.locator('.MuiPaginationItem-root.Mui-selected')).not.toHaveText(selected);
  }
  return item;
}

export async function evidence(page: Page, info: TestInfo, name: string, data?: unknown) {
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  if (data !== undefined) await info.attach(`${name}-data`, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
}

export async function openProfile(page: Page) {
  await page.locator('#styled-menu.MuiButton-text').last().click();
  await page.locator('#transition-popper').getByRole('button', { name: 'Edit account', exact: true }).click();
  await expect(page.locator('#modifyProfile')).toBeVisible();
}

export async function healthyPage(page: Page) {
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.MuiBackdrop-root:visible .MuiCircularProgress-root')).toHaveCount(0);
}

export const origin = new URL(BASE).origin;
