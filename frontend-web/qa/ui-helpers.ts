import { expect, Locator, Page, request, Response, TestInfo, test as baseTest } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import { API, Actor, BASE, GOLD, RECORDS, body, call, ok, paced, unique } from './helpers';
import {
  accountMenu,
  alertDialog,
  card,
  confirmDialog,
  datagridColumn,
  datagridRows,
  datagridTable,
  dismissDialog,
  errorSurface,
  expectSelected,
  fieldCombobox,
  gridCell,
  menuItem,
  nextPage,
  pagination,
  popupSurface,
  selectControl,
  successNotice,
  widgetTile,
} from '../e2e/ui-locators';

export {
  datagridColumn,
  datagridRows,
  datagridTable,
  expectSelected,
  gridCell,
  popupSurface,
  successNotice,
  widgetTile,
} from '../e2e/ui-locators';

export const test = baseTest.extend<{ browserHealth: void }>({
  browserHealth: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]')));
      await use();
      expect(errors, 'uncaught browser exceptions').toEqual([]);
    },
    { auto: true },
  ],
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
export const dialog = (page: Page) => alertDialog(page);
export { errorSurface };

export async function feedback(page: Page, text: string | RegExp) {
  await expect(errorSurface(page).filter({ hasText: text }).last()).toBeVisible();
}

export async function confirm(page: Page, accept = true) {
  await confirmDialog(page, accept);
}

export async function closeError(page: Page) {
  await dismissDialog(page);
}

export function visualCombobox(page: Page, label: string, scope: Page | Locator = page) {
  return fieldCombobox(page, label, scope);
}

export async function select(page: Page, target: Locator, value: string) {
  await selectControl(page, target, value);
}

export async function selectSqliteType(page: Page) {
  const sqlite = page.getByRole('button').filter({ hasText: /^SQLite/ });
  await expect(sqlite, 'step 1 must offer the SQLite database type').toHaveCount(1);
  await expect(sqlite).toBeVisible();
  await sqlite.click();
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

export async function oracleGrid(page: Page) {
  await expect(datagridTable(page)).toBeVisible();
  for (const [index, row] of RECORDS.entries()) {
    for (const [column, value] of Object.entries(row)) await gridCell(page, column, String(value), index);
  }
  await expect(datagridRows(page)).toHaveCount(GOLD.rowCount);
  for (const column of Object.keys(RECORDS[0])) {
    await expect(datagridColumn(page, column)).toBeVisible();
  }
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
  await page.getByPlaceholder(/^Enter SQL/).fill(sql);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const chooseFile = page.getByRole('button', { name: 'Choose file', exact: true });
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
  let row: string[] = [],
    field = '',
    quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if (character === '\n' && !quoted) {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  expect(quoted, 'CSV quotes must be balanced').toBe(false);
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
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
  await expect(widgetTile(page, title).getByText(String(GOLD.sumAmount), { exact: true }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    /Failed to load the widget|componentNotSelected|failedWidget|컴포넌트를 선택/,
  );
}

export async function addWidget(page: Page, title: string) {
  await page
    .getByRole('button', { name: /^(위젯 추가|Add widgets?)$/i })
    .first()
    .click();
  const popup = page.getByRole('dialog');
  await popup.getByRole('button', { name: title, exact: true }).click();
  await popup.getByRole('button', { name: /^(위젯 추가|Add widgets?)$/i }).click();
  await expect(popup).toHaveCount(0);
  await numericView(page, title);
}

export async function boardItem(page: Page, resource: 'widget' | 'dashboard', id: number) {
  const item = page.locator(`a[href="/${resource}/${id}"]`);
  const pager = pagination(page);
  await expect(pager).toBeVisible();
  const visited = new Set<string>();
  while (!(await item.isVisible())) {
    const selected = (await pager.locator('[aria-current="page"]').innerText()).trim();
    expect(visited.has(selected), 'listing pagination cannot loop').toBe(false);
    visited.add(selected);
    const next = nextPage(page);
    await expect(next, 'owned item must exist on an actual list page').toBeEnabled();
    await next.click();
    await expect(pager.locator('[aria-current="page"]')).not.toHaveText(selected);
  }
  return item;
}

export async function evidence(page: Page, info: TestInfo, name: string, data?: unknown) {
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  if (data !== undefined)
    await info.attach(`${name}-data`, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
}

export const profileDialog = (page: Page) =>
  page.getByRole('dialog').filter({ has: page.locator('input[name="userOldPwd"]') });

export async function openProfile(page: Page) {
  await accountMenu(page).click();
  await menuItem(page, 'Edit account').click();
  await expect(profileDialog(page)).toBeVisible();
}

export async function healthyPage(page: Page) {
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('[data-slot="spinner"]:visible')).toHaveCount(0);
}

export const origin = new URL(BASE).origin;
