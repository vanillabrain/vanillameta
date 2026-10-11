import { expect, Page, request } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { API, Actor, BASE, GOLD, RECORDS, authorize, body, call, dashboard, dataset, execute, metric, ok, paced, parquetBuffer, provider, signIn, unique, upload, widget } from './helpers';
import { ace, aceValue, addWidget, boardItem, browserFile, closeError, confirm, dialog, downloadCsv, errorSurface, evidence, feedback, filePage, fileQuery, gridCell, healthyPage, inventory, language, numericView, openProfile, oracleGrid, origin, parseCsv, persisted, runDataset, saveButton, savedResponse, select, selectSqliteType, test, uiActor, visualCombobox } from './ui-helpers';

const actors: Actor[] = [];
async function owner() { const value = await uiActor(); actors.push(value); return value; }
async function authenticated(page: Page) {
  const value = await owner();
  await authorize(page, value);
  return value;
}
async function numericFixture(page: Page) {
  const user = await authenticated(page);
  const source = await upload(user);
  const chart = await widget(user, source.id);
  return { user, source, chart };
}
async function boardFixture(page: Page) {
  const fixture = await numericFixture(page);
  return { ...fixture, board: await dashboard(fixture.user, fixture.chart.id) };
}
async function tokenAbsent(page: Page) {
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
}
async function freshSignin(user: Actor, password: string) {
  await paced();
  return user.context.post(`${API}/login/signin`, { data: { userId: user.userId, password } });
}
async function savedByTitle(user: Actor, resource: string, title: string) {
  const matches = (await inventory(user, resource)).filter((item: any) => item.title === title);
  expect(matches).toHaveLength(1);
  return persisted(user, resource, matches[0].id);
}
async function saveForm(page: Page, suffix: string, method = 'POST') {
  const response = page.waitForResponse(r => r.url().endsWith(suffix) && r.request().method() === method);
  await saveButton(page).click();
  await confirm(page);
  return savedResponse(await response);
}
async function loginFields(page: Page, userId: string, password: string) {
  await page.locator('input[name="userId"]').fill(userId);
  await page.locator('input[name="userPwd"]').fill(password);
}
async function signupFields(page: Page, fields: Record<string, string>) {
  for (const [name, value] of Object.entries(fields)) await page.locator(`input[name="${name}"]`).fill(value);
}
async function expiredToken(page: Page, user: Actor) {
  expect(Boolean(process.env.QA_ACCESS_SECRET), 'isolated runtime signing seam').toBe(true);
  const backend = createRequire(path.resolve(__dirname, '../../backend-api/package.json'));
  const jwt = backend('jsonwebtoken');
  const payload = jwt.decode(user.token);
  const expired = jwt.sign({ accessKeyData: payload.accessKeyData }, process.env.QA_ACCESS_SECRET, { expiresIn: -60 });
  await page.evaluate(value => localStorage.setItem('accessToken', JSON.stringify(value)), expired);
}
async function chooseNumeric(page: Page, sourceName: string) {
  await page.locator('li').filter({ hasText: sourceName }).click();
  await page.locator('li').filter({ hasText: 'uploaded_data' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('li').filter({ hasText: '숫자판' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await select(page, page.locator('#field'), 'amount');
  await select(page, page.locator('#aggregation'), 'Sum');
}

test.beforeEach(async ({ page }) => { await language(page); });
test.afterEach(async () => { for (const user of actors.splice(0)) await user.context.dispose(); });

for (const route of ['/dashboard/999999999', '/widget/999999999', '/data/source/create', '/data/set/create', '/data/metric', '/data/file', '/']) {
  test(`AUTH-01 anonymous protected navigation ${route}`, async ({ page }) => {
    const protectedResponses: number[] = [];
    page.on('response', response => { if (/\/v1\/(dashboard|widget|database|dataset|metric)(\/|\?|$)/.test(response.url())) protectedResponses.push(response.status()); });
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[name="userId"]')).toBeVisible();
    await expect(page.locator('.react-grid-item, .tui-grid-container')).toHaveCount(0);
    expect(protectedResponses.filter(status => status >= 200 && status < 300)).toEqual([]);
    await healthyPage(page);
  });
}

test('AUTH-01 anonymous unknown route reaches controlled public 404 or login without private content', async ({ page }) => {
  const protectedResponses: number[] = [];
  page.on('response', response => { if (/\/v1\/(dashboard|widget|database|dataset|metric)(\/|\?|$)/.test(response.url())) protectedResponses.push(response.status()); });
  await page.goto('/qa-unknown-route');
  const login = page.locator('input[name="userId"]');
  const notFound = page.getByText('404 Error', { exact: true });
  await expect(login.or(notFound)).toBeVisible();
  await expect(page).toHaveURL(/\/(?:login|qa-unknown-route)$/);
  if (new URL(page.url()).pathname === '/login') {
    await expect(login).toBeVisible();
    await expect(page.locator('input[name="userPwd"]')).toBeVisible();
  } else {
    await expect(notFound).toBeVisible();
    await expect(page.getByText('Page not found.', { exact: true })).toBeVisible();
  }
  await expect(page.locator('.react-grid-item, .tui-grid-container, a.MuiListItem-root[href^="/dashboard/"], a.MuiListItem-root[href^="/widget/"]')).toHaveCount(0);
  expect(protectedResponses.filter(status => status >= 200 && status < 300)).toEqual([]);
  await tokenAbsent(page);
  await healthyPage(page);
});

for (const variant of ['required-userId', 'required-userPwd', 'required-userConfirmPwd', 'required-userEmail', 'weak-password', 'mismatch', 'invalid-email']) {
  test(`AUTH-03 signup validation ${variant}`, async ({ page }) => {
    await page.goto('/signup');
    const userId = `qa${randomBytes(5).toString('hex')}`;
    const password = `Qa1!${randomBytes(6).toString('hex')}`;
    const fields = { userId, userPwd: password, userConfirmPwd: password, userEmail: `${userId}@example.test` };
    const messages: Record<string, string> = { required: 'Please fill in all fields.', 'weak-password': 'Password must be at least 8 characters', mismatch: 'Passwords do not match.', 'invalid-email': 'Please check the email format.' };
    if (variant.startsWith('required-')) fields[variant.slice('required-'.length) as keyof typeof fields] = '';
    if (variant === 'weak-password') fields.userPwd = fields.userConfirmPwd = 'weak';
    if (variant === 'mismatch') fields.userConfirmPwd = `${password}different`;
    if (variant === 'invalid-email') fields.userEmail = 'not-an-email';
    let signupRequests = 0;
    page.on('request', r => { if (r.url().endsWith('/login/signup')) signupRequests++; });
    await signupFields(page, fields);
    await page.locator('button[type="submit"]').click();
    await feedback(page, messages[variant.startsWith('required-') ? 'required' : variant]);
    expect(signupRequests).toBe(0);
    await expect(page).toHaveURL(/\/signup$/);
    const context = await request.newContext();
    await paced();
    expect((await context.post(`${API}/login/signin`, { data: { userId, password } })).status()).toBe(401);
    await context.dispose();
  });
}

test('AUTH-04 actual signup and populated starter dashboard', async ({ page }, info) => {
  const userId = `qa${randomBytes(5).toString('hex')}`;
  const password = `Qa1!${randomBytes(6).toString('hex')}`;
  const email = `${userId}@example.test`;
  await page.goto('/signup');
  await signupFields(page, { userId, userPwd: password, userConfirmPwd: password, userEmail: email });
  const response = page.waitForResponse(r => r.url().endsWith('/login/signup'));
  await page.locator('button[type="submit"]').click();
  expect((await response).status()).toBe(201);
  await confirm(page);
  const context = await request.newContext();
  const user: Actor = { userId, password, email, token: '', base: API, context };
  actors.push(user);
  await signIn(page, user);
  user.token = await page.evaluate(() => JSON.parse(localStorage.getItem('accessToken')!));
  await expect.poll(async () => (await inventory(user, 'dashboard')).length).toBeGreaterThan(0);
  const boards = await inventory(user, 'dashboard');
  const starter = await persisted(user, 'dashboard', boards[0].id);
  expect(starter.widgets.length).toBeGreaterThan(0);
  await page.goto(`/dashboard/${starter.id}`);
  await expect(page.locator('.react-grid-item')).toHaveCount(starter.widgets.length);
  await expect(page.locator('body')).not.toContainText(/Failed to load the widget|componentNotSelected/);
  const numeric = starter.widgets.find((item: any) => item.componentType === 'BOARD_NUMERIC');
  expect(numeric, 'onboarding must include an actual populated numeric widget').toBeTruthy();
  await expect(page.locator('.MuiCard-root').filter({ hasText: numeric.title }).locator('span').filter({ hasText: /^\d[\d,.]*$/ }).last()).toBeVisible();
  for (const item of starter.widgets) {
    const data = await ok(await call(user, 'GET', '/database/data', undefined, { params: { datasetType: item.datasetType, datasetId: item.datasetId, databaseId: item.databaseId, tableName: item.tableName } }));
    expect(data.datas.length, 'starter widget must receive nonempty real data').toBeGreaterThan(0);
  }
  await evidence(page, info, 'AUTH-04-starter', { dashboardId: starter.id, widgetIds: starter.widgets.map((item: any) => item.id) });
});

for (const variant of ['wrong-password', 'unknown-account']) {
  test(`AUTH-06 failed login ${variant} and later valid login`, async ({ page }) => {
    const user = await owner();
    await page.goto('/login');
    await loginFields(page, variant === 'unknown-account' ? `qa${randomBytes(5).toString('hex')}` : user.userId, 'Wrong1!Password');
    const pending = page.waitForResponse(r => r.url().endsWith('/login/signin'));
    await page.locator('button[type="submit"]').click();
    expect((await pending).status()).toBe(401);
    await feedback(page, 'Invalid ID or password.');
    await tokenAbsent(page);
    await expect(page).toHaveURL(/\/login$/);
    await signIn(page, user);
    await expect(page.locator('nav.MuiAppBar-root')).toBeVisible();
  });
}

test('AUTH-07 actual login, reload and correct password-free profile', async ({ page }) => {
  const user = await owner();
  await signIn(page, user);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await openProfile(page);
  await expect(page.locator('#modifyProfile input[name="userId"]')).toHaveValue(user.userId);
  await expect(page.locator('#modifyProfile input[name="userEmail"]')).toHaveValue(user.email);
  const profile = await body(await call(user, 'GET', '/user/userinfo'));
  expect(JSON.stringify(profile)).not.toMatch(/"(?:password|new_password)"/);
  expect(JSON.stringify(profile)).toContain(user.userId);
});

test('AUTH-08 browser expired access refresh-cookie renewal and original request retry', async ({ page, context }) => {
  const user = await owner();
  await signIn(page, user);
  const cookies = (await context.cookies(API)).filter(cookie => cookie.name === 'jwt_re');
  expect(cookies.length, 'real UI signin must supply refresh cookie; no cookie injection').toBe(1);
  expect(cookies[0].httpOnly).toBe(true);
  await expiredToken(page, user);
  const refresh = page.waitForResponse(r => r.url().endsWith('/user/get-access-token'));
  const retried = page.waitForResponse(r => r.url().endsWith('/dashboard') && r.status() === 200);
  let renewals = 0;
  page.on('request', r => { if (r.url().endsWith('/user/get-access-token')) renewals++; });
  await page.reload();
  expect((await refresh).status()).toBe(201);
  expect((await retried).ok()).toBe(true);
  await expect(page.locator('nav.MuiAppBar-root')).toBeVisible();
  expect(renewals).toBe(1);
  await healthyPage(page);
});

test('AUTH-09 expired access without cookie recovers to controlled login', async ({ page, context }) => {
  const user = await owner();
  await signIn(page, user);
  await context.clearCookies();
  await expiredToken(page, user);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await tokenAbsent(page);
  await expect(page.locator('input[name="userId"]')).toBeVisible();
  await healthyPage(page);
});

test('AUTH-10 real logout clears cookie and revokes saved refresh credential', async ({ page, context }) => {
  const user = await owner();
  await signIn(page, user);
  const cookies = (await context.cookies(API)).filter(cookie => cookie.name === 'jwt_re');
  expect(cookies.length, 'UI login must create its own HTTPOnly cookie').toBe(1);
  expect(cookies[0].httpOnly).toBe(true);
  const previous = cookies[0];
  await page.locator('#styled-menu.MuiButton-text').last().click();
  await page.locator('#transition-popper').getByRole('button', { name: /Sign out|Logout/ }).click();
  const pending = page.waitForResponse(r => r.url().endsWith('/login/signout'));
  await confirm(page);
  expect((await pending).status()).toBe(201);
  expect((await context.cookies(API)).filter(cookie => cookie.name === 'jwt_re')).toHaveLength(0);
  await tokenAbsent(page);
  const replay = await request.newContext({ storageState: { cookies: [previous], origins: [] } });
  await paced();
  expect((await replay.post(`${API}/user/get-access-token`)).status()).toBe(401);
  await replay.dispose();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(page.locator('input[name="userId"]')).toBeVisible();
});

for (const valid of [false, true]) {
  test(`AUTH-${valid ? '12' : '11'} profile ${valid ? 'password/email update' : 'wrong current password'}`, async ({ page }) => {
    const user = await owner();
    await signIn(page, user);
    await openProfile(page);
    const password = `Qa2!${randomBytes(6).toString('hex')}`;
    const email = `${unique()}@example.test`;
    await signupFields(page, { userOldPwd: valid ? user.password : 'Wrong1!Password', userNewPwd: password, userNewConfirmPwd: password, userEmail: email });
    const pending = page.waitForResponse(r => r.url().endsWith('/user/change-info') && r.request().method() === 'PATCH');
    await page.locator('button[form="modifyProfile"]').click();
    const response = await pending;
    if (valid) {
      expect(response.status()).toBe(200);
      await expect(dialog(page)).toContainText(/updated|success/i);
      await confirm(page);
      await expect(page.locator('#modifyProfile')).toHaveCount(0);
      const profile = await body(await call(user, 'GET', '/user/userinfo'));
      expect(JSON.stringify(profile)).toContain(email);
      expect((await freshSignin(user, user.password)).status()).toBe(401);
      expect((await freshSignin(user, password)).status()).toBe(201);
      await page.evaluate(() => localStorage.removeItem('accessToken'));
      await page.reload();
      await expect(page).toHaveURL(/\/login$/);
      await signIn(page, { ...user, password, email });
      await openProfile(page);
      await expect(page.locator('#modifyProfile input[name="userEmail"]')).toHaveValue(email);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
      await feedback(page, /Incorrect|Failed/);
      const profile = await body(await call(user, 'GET', '/user/userinfo'));
      expect(JSON.stringify(profile)).toContain(user.email);
      expect(JSON.stringify(profile)).not.toContain(email);
      expect((await freshSignin(user, user.password)).status()).toBe(201);
      expect((await freshSignin(user, password)).status()).toBe(401);
    }
    await healthyPage(page);
  });
}

test('AUTH-14 corrupt local access-token JSON recovers without routing crash', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('accessToken', '{not-json'));
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('input[name="userId"]')).toBeVisible();
  await tokenAbsent(page);
  await healthyPage(page);
});

for (const format of ['csv', 'json', 'parquet']) {
  test(`FILE-0${['csv', 'json', 'parquet'].indexOf(format) + 1} ${format} oracle rows, aggregate and export`, async ({ page }, info) => {
    await authenticated(page);
    await filePage(page);
    const buffer = format === 'parquet' ? (await parquetBuffer()).buffer : Buffer.from(format === 'json' ? JSON.stringify(RECORDS) : GOLD.salesCsv);
    await browserFile(page, `${unique()}.${format}`, buffer);
    await oracleGrid(page);
    await fileQuery(page, GOLD.aggregateSql);
    await gridCell(page, 'total', '500');
    expect(parseCsv(await downloadCsv(page))).toEqual([['total'], ['500']]);
    await evidence(page, info, `FILE-${format}-aggregate`);
  });
}

test('FILE-04 real bar line pie controls retain exact data and axes', async ({ page }, info) => {
  await authenticated(page);
  await filePage(page);
  await browserFile(page);
  await fileQuery(page, GOLD.rowsSql);
  await oracleGrid(page);
  await select(page, visualCombobox(page, 'X axis'), 'name');
  await select(page, visualCombobox(page, 'Value'), 'amount');
  for (const type of ['Bar', 'Line', 'Pie']) {
    await select(page, visualCombobox(page, 'Chart'), type);
    await expect(page.locator('.echarts-for-react canvas').first()).toBeVisible();
    await expect(visualCombobox(page, 'X axis')).toHaveText('name');
    await expect(visualCombobox(page, 'Value')).toHaveText('amount');
    await oracleGrid(page);
    const serialized = parseCsv(await downloadCsv(page));
    expect(serialized).toEqual(parseCsv(GOLD.salesCsv));
    await evidence(page, info, `FILE-04-${type}`, { input: RECORDS, x: 'name', y: 'amount', chartType: type });
  }
});

test('FILE-05 syntax error is explicit and later aggregate recovers', async ({ page }) => {
  await authenticated(page);
  await filePage(page);
  await browserFile(page);
  await fileQuery(page, GOLD.aggregateSql);
  await gridCell(page, 'total', '500');
  await fileQuery(page, 'not valid SQL');
  await feedback(page, 'Query failed:');
  await expect(page.locator('.MuiAlert-standardSuccess').filter({ hasText: /query|SQL/i })).toHaveCount(0);
  await closeError(page);
  await fileQuery(page, GOLD.aggregateSql);
  await gridCell(page, 'total', '500');
});

test('FILE-06 empty result clears prior rows and visual preview', async ({ page }) => {
  await authenticated(page);
  await filePage(page);
  await browserFile(page);
  await oracleGrid(page);
  await fileQuery(page, GOLD.emptySql);
  await expect(page.locator('.tui-grid-container, .echarts-for-react')).toHaveCount(0);
  await fileQuery(page, GOLD.aggregateSql);
  await gridCell(page, 'total', '500');
});

test('FILE-07 literal comma quote Unicode newline CSV export round-trip', async ({ page }) => {
  await authenticated(page);
  await filePage(page);
  const literal = 'id,name,amount\n1,"서울,alpha",100\n2,"a ""quoted"" value",250\n3,"line one\nline two",150\n';
  await browserFile(page, `${unique()}.csv`, Buffer.from(literal));
  await gridCell(page, 'name', '서울,alpha', 0);
  await gridCell(page, 'name', 'a "quoted" value', 1);
  await gridCell(page, 'name', 'line one\nline two', 2);
  expect(parseCsv(await downloadCsv(page))).toEqual([['id', 'name', 'amount'], ['1', '서울,alpha', '100'], ['2', 'a "quoted" value', '250'], ['3', 'line one\nline two', '150']]);
});

test('FILE-08 unsafe BIGINT stays exact in grid and downloaded bytes', async ({ page }) => {
  await authenticated(page);
  await filePage(page);
  await browserFile(page);
  await fileQuery(page, GOLD.bigIntSql);
  await gridCell(page, 'huge', '9007199254740993');
  expect(parseCsv(await downloadCsv(page))).toEqual([['huge'], ['9007199254740993']]);
});

test('FILE-09 replace file clears old metadata rows and incompatible axes', async ({ page }) => {
  await authenticated(page);
  await filePage(page);
  const oldName = `${unique()}.csv`;
  await browserFile(page, oldName);
  await select(page, visualCombobox(page, 'X axis'), 'region');
  await select(page, visualCombobox(page, 'Value'), 'amount');
  const name = `${unique()}.json`;
  await browserFile(page, name, Buffer.from(JSON.stringify([{ replacement: 'new-only', score: 7 }])));
  await gridCell(page, 'replacement', 'new-only');
  await gridCell(page, 'score', '7');
  await expect(page.locator('.tui-grid-body-area [data-row-key="1"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(oldName);
  await expect(visualCombobox(page, 'X axis')).toHaveText('replacement');
  await expect(visualCombobox(page, 'Value')).toHaveText('score');
  expect(parseCsv(await downloadCsv(page))).toEqual([['replacement', 'score'], ['new-only', '7']]);
});

test('FILE-10 valid apostrophe spaces Unicode filename loads without SQL quoting break', async ({ page }) => {
  await authenticated(page);
  await filePage(page);
  await browserFile(page, `qa_${randomBytes(4).toString('hex')} O'Brien 서울 sales.csv`);
  await oracleGrid(page);
  await fileQuery(page, GOLD.aggregateSql);
  await gridCell(page, 'total', '500');
});

for (const variant of [{ extension: 'txt', buffer: Buffer.from(GOLD.salesCsv), message: 'Only CSV, Parquet, and JSON' }, { extension: 'json', buffer: Buffer.from('{invalid'), message: 'File analysis failed:' }, { extension: 'parquet', buffer: Buffer.from('invalid parquet'), message: 'File analysis failed:' }]) {
  test(`FILE-11 ${variant.extension} controlled rejection and valid upload recovery`, async ({ page }) => {
    await authenticated(page);
    await filePage(page);
    await page.locator('input[type="file"]').setInputFiles({ name: `${unique()}.${variant.extension}`, mimeType: 'application/octet-stream', buffer: variant.buffer });
    await feedback(page, variant.message);
    await expect(page.locator('.MuiAlert-standardSuccess')).toHaveCount(0);
    await expect(page.locator('.tui-grid-container')).toHaveCount(0);
    await closeError(page);
    await browserFile(page);
    await oracleGrid(page);
    await fileQuery(page, GOLD.aggregateSql);
    await gridCell(page, 'total', '500');
  });
}

test('FILE-12 fault injection WASM failure, disabled upload and navigation recovery', async ({ page }) => {
  await authenticated(page);
  await page.route(/\.wasm(?:\?|$)/, route => route.abort('failed'));
  await page.goto('/data/file');
  await feedback(page, 'Failed to load the in-browser analytics engine.');
  await closeError(page);
  await expect(page.getByRole('button', { name: 'Choose file' })).toBeDisabled();
  await page.unroute(/\.wasm(?:\?|$)/);
  await page.goto('/dashboard');
  await filePage(page);
  await browserFile(page);
  await oracleGrid(page);
});

for (const invalidFirst of [false, true]) {
  test(`DATA-0${invalidFirst ? 2 : 1} SQLite form ${invalidFirst ? 'invalid config then recovery' : 'test save reload'}`, async ({ page }) => {
    const user = await authenticated(page);
    const source = await upload(user);
    const sourceInfo = await ok(await call(user, 'GET', `/database/info/${source.id}`));
    const filename = sourceInfo.databaseInfo.connectionConfig.filename;
    expect(typeof filename).toBe('string');
    const before = await inventory(user, 'database');
    const title = unique();
    await page.goto('/data/source/create');
    await selectSqliteType(page);
    await page.locator('input[name="name"]').fill(title);
    await page.locator('input[name="filename"]').fill(invalidFirst ? `${filename}/missing-directory/qa.db` : filename);
    if (invalidFirst) {
      const failed = page.waitForResponse(r => r.url().endsWith('/database/test'));
      await page.getByRole('button', { name: 'TEST CONNECT', exact: true }).click();
      const response = await failed;
      expect(response.status()).toBeLessThan(500);
      await feedback(page, 'Cannot connect.');
      await expect(saveButton(page)).toBeDisabled();
      expect((await inventory(user, 'database')).map((item: any) => item.id)).toEqual(before.map((item: any) => item.id));
      await page.locator('input[name="filename"]').fill(filename);
    }
    const connected = page.waitForResponse(r => r.url().endsWith('/database/test'));
    await page.getByRole('button', { name: 'TEST CONNECT', exact: true }).click();
    expect((await (await connected).json()).status).toBe('SUCCESS');
    await expect(page.locator('.MuiAlert-standardSuccess')).toContainText('Connected to database.');
    await expect(saveButton(page)).toBeEnabled();
    await saveForm(page, '/database');
    const saved = (await inventory(user, 'database')).filter((item: any) => item.name === title);
    expect(saved).toHaveLength(1);
    const fresh = await ok(await call(user, 'GET', `/database/info/${saved[0].id}`));
    expect(fresh.databaseInfo.connectionConfig.filename).toBe(filename);
    await page.goto(`/data/source/modify/${saved[0].id}`);
    await page.reload();
    await expect(page.locator('input[name="name"]')).toHaveValue(title);
    expect((await execute(user, saved[0].id)).datas).toEqual([{ total: GOLD.sumAmount }]);
  });
}

test('SET-01 browser upload, exact aggregate editor run and persisted dataset', async ({ page }) => {
  const user = await authenticated(page);
  await filePage(page);
  await browserFile(page);
  await oracleGrid(page);
  const uploaded = page.waitForResponse(r => r.url().endsWith('/database/upload'));
  await page.getByRole('button', { name: 'Save as dataset', exact: true }).click();
  const source = await savedResponse(await uploaded);
  await expect(page).toHaveURL(new RegExp(`/data/set/create/${source.id}$`));
  const title = unique();
  await page.locator('#userSetName').fill(title);
  await runDataset(page);
  await saveForm(page, '/dataset');
  const saved = await savedByTitle(user, 'dataset', title);
  expect(saved.title).toBe(title);
  expect(saved.query).toBe(GOLD.aggregateSql);
  expect(Number(saved.databaseId)).toBe(source.id);
  await page.goto(`/data/set/modify/${saved.id}`);
  await page.reload();
  await expect(page.locator('#userSetName')).toHaveValue(title);
  expect(await aceValue(page)).toBe(GOLD.aggregateSql);
});

test('SET-02 actual modification persists query and changes linked widget data', async ({ page }) => {
  const { user, source, chart } = await numericFixture(page);
  const original = await persisted(user, 'dataset', chart.datasetId);
  const title = unique();
  await page.goto(`/data/set/modify/${original.id}`);
  await expect(page.locator('#userSetName')).toHaveValue(original.title);
  await expect.poll(() => aceValue(page)).toBe(original.query);
  await page.locator('#userSetName').fill(title);
  await runDataset(page, GOLD.emptySql);
  await saveForm(page, `/dataset/${original.id}`, 'PUT');
  const changed = await persisted(user, 'dataset', original.id);
  expect(changed.title).toBe(title);
  expect(changed.query).toBe(GOLD.emptySql);
  await page.goto(`/widget/${chart.id}`);
  const pending = page.waitForResponse(r => r.url().includes('/database/data'));
  await page.reload();
  expect((await (await pending).json()).data.datas).toEqual([]);
  await expect(page.locator('.MuiCard-root').getByText('500', { exact: true })).toHaveCount(0);
  await page.goto(`/data/set/modify/${original.id}`);
  await expect(page.locator('#userSetName')).toHaveValue(changed.title);
  await expect.poll(() => aceValue(page)).toBe(changed.query);
  await runDataset(page, GOLD.rowsSql);
  await saveForm(page, `/dataset/${original.id}`, 'PUT');
  await page.goto(`/widget/${chart.id}`);
  await numericView(page, chart.title);
  expect((await execute(user, source.id)).datas).toEqual([{ total: GOLD.sumAmount }]);
});

for (const variant of ['invalid-query', 'required-title']) {
  test(`SET-03 ${variant} cannot overwrite or create persisted definition`, async ({ page }) => {
    const user = await authenticated(page);
    const source = await upload(user);
    const existing = await dataset(user, source.id);
    const before = await inventory(user, 'dataset');
    await page.goto(variant === 'invalid-query' ? `/data/set/modify/${existing.id}` : `/data/set/create/${source.id}`);
    let mutations = 0;
    page.on('request', r => { if (/\/dataset(?:\/\d+)?$/.test(r.url()) && ['POST', 'PUT'].includes(r.method())) mutations++; });
    if (variant === 'invalid-query') {
      await ace(page, 'not valid SQL');
      const failed = page.waitForResponse(r => r.url().endsWith('/database/execute'));
      await page.getByRole('button', { name: 'Run', exact: true }).click();
      expect((await failed).status()).toBeLessThan(500);
      await expect(errorSurface(page)).toBeVisible();
      await expect(saveButton(page)).toBeDisabled();
    } else {
      await page.locator('#userSetName').fill('');
      await runDataset(page);
      await saveButton(page).click();
      expect(await page.locator('#userSetName').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
      expect((await page.locator('#userSetName').evaluate((input: HTMLInputElement) => input.validationMessage)).length).toBeGreaterThan(0);
      await expect(page.locator('#userSetName:invalid')).toBeVisible();
      await expect(dialog(page)).toHaveCount(0);
    }
    expect(mutations).toBe(0);
    expect((await inventory(user, 'dataset')).map((item: any) => item.id)).toEqual(before.map((item: any) => item.id));
    expect((await persisted(user, 'dataset', existing.id)).query).toBe(GOLD.aggregateSql);
  });
}

async function metricForm(page: Page, sourceName: string, name: string) {
  await page.getByRole('button', { name: 'Add metric', exact: true }).click();
  const popup = page.getByRole('dialog');
  await popup.getByLabel('Name', { exact: false }).first().fill(name);
  await select(page, visualCombobox(page, 'Database', popup), sourceName);
  await popup.getByLabel('Table name', { exact: false }).fill('uploaded_data');
  await select(page, visualCombobox(page, 'Aggregation', popup), 'SUM');
  await popup.getByLabel('Expression column', { exact: false }).fill('amount');
  return popup;
}

test('METRIC-01 browser create evaluate reload delete with exact 500 and persisted evaluation', async ({ page }) => {
  const user = await authenticated(page);
  const source = await upload(user);
  const name = unique();
  await page.goto('/data/metric');
  const popup = await metricForm(page, source.name, name);
  const created = page.waitForResponse(r => r.url().endsWith('/metric') && r.request().method() === 'POST');
  await popup.getByRole('button', { name: 'Create', exact: true }).click();
  const saved = await savedResponse(await created);
  await expect(popup).toHaveCount(0);
  const card = page.locator('.MuiCard-root').filter({ hasText: name });
  await card.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await gridCell(page, 'value', '500');
  const evaluation = await ok(await call(user, 'POST', `/metric/${saved.id}/evaluate`));
  expect(evaluation.result).toEqual([{ value: GOLD.sumAmount }]);
  await page.reload();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await gridCell(page, 'value', '500');
  const deleted = page.waitForResponse(r => r.url().endsWith(`/metric/${saved.id}`) && r.request().method() === 'DELETE');
  await card.locator('button').last().click();
  expect((await deleted).ok()).toBe(true);
  await expect(card).toHaveCount(0);
  expect((await inventory(user, 'metric')).some((item: any) => item.id === saved.id)).toBe(false);
});

for (const variant of ['required-fields', 'duplicate-name', 'cancel']) {
  test(`METRIC-02 ${variant} creates no extra active metric`, async ({ page }) => {
    const user = await authenticated(page);
    const source = await upload(user);
    const existing = await metric(user, source.id);
    const before = await inventory(user, 'metric');
    await page.goto('/data/metric');
    if (variant === 'required-fields') {
      await page.getByRole('button', { name: 'Add metric', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
      await feedback(page, 'Name, database, table, and expression are required.');
    } else {
      const popup = await metricForm(page, source.name, variant === 'duplicate-name' ? existing.name : unique());
      if (variant === 'cancel') {
        await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(popup).toHaveCount(0);
      } else {
        const pending = page.waitForResponse(r => r.url().endsWith('/metric') && r.request().method() === 'POST');
        await popup.getByRole('button', { name: 'Create', exact: true }).click();
        expect((await pending).status()).toBeLessThan(500);
        await feedback(page, /exists|duplicate|already|Failed/i);
      }
    }
    expect((await inventory(user, 'metric')).map((item: any) => item.id)).toEqual(before.map((item: any) => item.id));
  });
}

test('WIDGET-01 real numeric wizard selects owned amount source and persists sum 500', async ({ page }) => {
  const user = await authenticated(page);
  const source = await upload(user);
  const title = unique();
  await page.goto('/widget/create');
  await chooseNumeric(page, source.name);
  await page.locator('#title').fill(title);
  await saveForm(page, '/widget');
  const saved = await savedByTitle(user, 'widget', title);
  expect(saved.componentType).toBe('BOARD_NUMERIC');
  const option = typeof saved.option === 'string' ? JSON.parse(saved.option) : saved.option;
  expect(option.content.field).toBe('amount');
  expect(option.content.aggregation).toBe('sum');
  await page.goto(`/widget/${saved.id}`);
  await numericView(page, title);
  await page.reload();
  await numericView(page, title);
});

test('WIDGET-02 missing required selections, back preserves valid data and cancellation creates no widget', async ({ page }) => {
  const user = await authenticated(page);
  const source = await upload(user);
  const before = await inventory(user, 'widget');
  await page.goto('/widget/create');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.locator('li').filter({ hasText: source.name }).click();
  await page.locator('li').filter({ hasText: 'uploaded_data' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.locator('li').filter({ hasText: '숫자판' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('#title').fill(unique());
  await saveButton(page).click();
  expect(await page.locator('input[name="field"]').evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  await expect(dialog(page)).toHaveCount(0);
  await select(page, page.locator('#field'), 'amount');
  await select(page, page.locator('#aggregation'), 'Sum');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.locator('li').filter({ hasText: '숫자판' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.locator('li').filter({ hasText: source.name })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true }), 'back must preserve valid source/table choice').toBeEnabled();
  await page.getByRole('link', { name: 'Widget', exact: true }).last().click();
  await expect(page).toHaveURL(/\/widget$/);
  expect((await inventory(user, 'widget')).map((item: any) => item.id)).toEqual(before.map((item: any) => item.id));
});

test('WIDGET-02 cancel populated wizard leaves persisted widget inventory unchanged', async ({ page }) => {
  const user = await authenticated(page);
  const source = await upload(user);
  const before = await inventory(user, 'widget');
  await page.goto('/widget/create');
  await chooseNumeric(page, source.name);
  await page.locator('#title').fill(unique());
  await saveButton(page).click();
  await confirm(page, false);
  await page.getByRole('link', { name: 'Widget', exact: true }).last().click();
  await expect(page).toHaveURL(/\/widget$/);
  expect((await inventory(user, 'widget')).map((item: any) => item.id)).toEqual(before.map((item: any) => item.id));
});

test('WIDGET-02 labeled save-error fault injection creates no widget and never reports saved success', async ({ page }) => {
  const user = await authenticated(page);
  const source = await upload(user);
  const before = await inventory(user, 'widget');
  await page.goto('/widget/create');
  await chooseNumeric(page, source.name);
  const title = unique();
  await page.locator('#title').fill(title);
  await page.route(`${API}/widget`, route => route.request().method() === 'POST'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ERROR', message: 'QA widget-save fault injection' }) })
    : route.continue());
  try {
    await saveFormExpectError(page);
    expect((await inventory(user, 'widget')).map((item: any) => item.id)).toEqual(before.map((item: any) => item.id));
    await expect(page.locator('.MuiAlert-standardSuccess').filter({ hasText: 'Widget saved.' })).toHaveCount(0);
    await expect(page.locator('body')).toContainText(/QA widget-save fault injection|Failed to save/i);
    await expect(page).toHaveURL(/\/widget\/create$/);
  } finally { await page.unroute(`${API}/widget`); }
});

async function saveFormExpectError(page: Page) {
  const pending = page.waitForResponse(r => r.url().endsWith('/widget') && r.request().method() === 'POST');
  await saveButton(page).click();
  await confirm(page);
  expect((await (await pending).json()).status).toBe('ERROR');
}

test('WIDGET-03 actual title and option edit survives reload and dashboard', async ({ page }) => {
  const { user, chart } = await numericFixture(page);
  const title = unique();
  await page.goto(`/widget/modify?id=${chart.id}`);
  await expect(page.locator('#title')).toHaveValue(chart.title);
  await page.locator('#title').fill(title);
  await page.locator('input[name="prefix"]').fill('QA ');
  await select(page, page.locator('#aggregation'), 'Sum');
  await saveForm(page, `/widget/${chart.id}`, 'PUT');
  const saved = await persisted(user, 'widget', chart.id);
  expect(saved.title).toBe(title);
  expect(saved.option.content.prefix).toBe('QA ');
  expect(saved.option.content.field).toBe('amount');
  const board = await dashboard(user, chart.id);
  await page.goto(`/dashboard/${board.id}`);
  await expect(page.locator('.MuiCard-root').getByText('QA 500', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.MuiCard-root').getByText('QA 500', { exact: true })).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

for (const resource of ['widget', 'dashboard'] as const) {
  test(`${resource === 'widget' ? 'WIDGET-04' : 'DASH-04'} actual list cancel deletion then remove only owned ID`, async ({ page }) => {
    const { user, chart, board } = await boardFixture(page);
    const target = resource === 'widget' ? chart : board;
    const before = await inventory(user, resource);
    await page.goto(`/${resource}`);
    const item = await boardItem(page, resource, target.id);
    await expect(item).toContainText(target.title);
    await item.locator('button').last().click();
    await confirm(page, false);
    expect((await persisted(user, resource, target.id)).title).toBe(target.title);
    await item.locator('button').last().click();
    const pending = page.waitForResponse(r => r.url().endsWith(`/${resource}/${target.id}`) && r.request().method() === 'DELETE');
    await confirm(page);
    expect((await pending).ok()).toBe(true);
    await expect(item).toHaveCount(0);
    expect((await inventory(user, resource)).map((entry: any) => entry.id).sort()).toEqual(before.filter((entry: any) => entry.id !== target.id).map((entry: any) => entry.id).sort());
    if (resource === 'dashboard') {
      await page.goto(`/dashboard/${target.id}`);
      await feedback(page, 'Failed to load dashboard.');
      await expect(page.locator('.react-grid-item')).toHaveCount(0);
    }
  });
}

for (const variant of ['missing-widget', 'deleted-datasource']) {
  test(`WIDGET-07 ${variant} explicit unavailable UI then valid widget recovery`, async ({ page }) => {
    const { user, chart } = await numericFixture(page);
    const validSource = await upload(user);
    const valid = await widget(user, validSource.id);
    if (variant === 'deleted-datasource') {
      const definition = await persisted(user, 'dataset', chart.datasetId);
      await ok(await call(user, 'DELETE', `/database/${definition.databaseId}`));
    }
    await page.goto(`/widget/${variant === 'missing-widget' ? 999999999 : chart.id}`);
    await expect(page.locator('body')).toContainText(/not found|unavailable|Failed to load|does not exist/i);
    await expect(page.locator('.MuiCard-root').getByText('500', { exact: true })).toHaveCount(0);
    await page.goto(`/widget/${valid.id}`);
    await numericView(page, valid.title);
    await healthyPage(page);
  });
}

test('DASH-01 browser dashboard create preserves owned widget layout and numeric result', async ({ page }) => {
  const { user, chart } = await numericFixture(page);
  const title = unique();
  await page.goto('/dashboard/create');
  await page.locator('#userDashboardName').fill(title);
  await addWidget(page, chart.title);
  await saveForm(page, '/dashboard');
  const saved = await savedByTitle(user, 'dashboard', title);
  expect(saved.widgets.map((item: any) => item.id)).toEqual([chart.id]);
  expect(saved.layout).toHaveLength(1);
  expect(Number(saved.layout[0].i)).toBe(chart.id);
  for (const property of ['x', 'y', 'w', 'h']) expect(Number.isFinite(saved.layout[0][property])).toBe(true);
  await page.goto(`/dashboard/${saved.id}`);
  await numericView(page, title);
});

test('DASH-02 browser title add remove membership persists after reload', async ({ page }) => {
  const { user, source, chart, board } = await boardFixture(page);
  const added = await widget(user, source.id);
  const title = unique();
  await page.goto(`/dashboard/modify?id=${board.id}`);
  await expect(page.locator('#userDashboardName')).toHaveValue(board.title);
  await page.locator('#userDashboardName').fill(title);
  await addWidget(page, added.title);
  await page.locator('.react-grid-item').filter({ hasText: chart.title }).locator('button').last().click();
  await saveForm(page, `/dashboard/${board.id}`, 'PUT');
  const saved = await persisted(user, 'dashboard', board.id);
  expect(saved.title).toBe(title);
  expect(saved.widgets.map((item: any) => item.id)).toEqual([added.id]);
  expect(saved.layout.map((item: any) => Number(item.i))).toEqual([added.id]);
  await page.reload();
  await numericView(page, title);
  await expect(page.getByText(added.title, { exact: true })).toBeVisible();
  await expect(page.getByText(chart.title, { exact: true })).toHaveCount(0);
});

test('DASH-03 real drag and resize persist finite changed layout after save reload', async ({ page }, info) => {
  const { user, chart, board } = await boardFixture(page);
  const before = await persisted(user, 'dashboard', board.id);
  await page.goto(`/dashboard/modify?id=${board.id}`);
  const item = page.locator('.react-grid-item').filter({ hasText: chart.title });
  await expect(item).toBeVisible();
  const box = await item.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 80, box!.y + 25);
  await page.mouse.down();
  await page.mouse.move(box!.x + 330, box!.y + 140, { steps: 12 });
  await page.mouse.up();
  const handle = item.locator('.react-resizable-handle');
  await handle.scrollIntoViewIfNeeded();
  const resize = await handle.boundingBox();
  expect(resize).not.toBeNull();
  await page.mouse.move(resize!.x + resize!.width / 2, resize!.y + resize!.height / 2);
  await page.mouse.down();
  await page.mouse.move(resize!.x - 100, resize!.y + 110, { steps: 12 });
  await page.mouse.up();
  await saveForm(page, `/dashboard/${board.id}`, 'PUT');
  const saved = await persisted(user, 'dashboard', board.id);
  expect(saved.layout).toHaveLength(1);
  const oldLayout = before.layout[0], newLayout = saved.layout[0];
  expect({ x: newLayout.x, y: newLayout.y }).not.toEqual({ x: oldLayout.x, y: oldLayout.y });
  expect({ w: newLayout.w, h: newLayout.h }).not.toEqual({ w: oldLayout.w, h: oldLayout.h });
  for (const key of ['x', 'y', 'w', 'h']) { expect(Number.isFinite(newLayout[key])).toBe(true); expect(newLayout[key]).toBeGreaterThanOrEqual(0); }
  await page.reload();
  await numericView(page, board.title);
  expect((await persisted(user, 'dashboard', board.id)).layout).toEqual(saved.layout);
  await evidence(page, info, 'DASH-03-layout', { before: before.layout, after: saved.layout });
});

for (const variant of ['unknown', 'deleted']) {
  test(`DASH-07 ${variant} deep link has explicit unavailable state`, async ({ page }) => {
    const { user, board } = await boardFixture(page);
    if (variant === 'deleted') await ok(await call(user, 'DELETE', `/dashboard/${board.id}`));
    await page.goto(`/dashboard/${variant === 'unknown' ? 999999999 : board.id}`);
    await feedback(page, 'Failed to load dashboard.');
    await expect(page.locator('.react-grid-item')).toHaveCount(0);
    await healthyPage(page);
  });
}

test('DASH-08 actual recommendation template creation maps chosen widget exactly once', async ({ page }) => {
  const { user, chart } = await numericFixture(page);
  await page.goto('/dashboard/create?createType=recommend');
  const popup = page.getByRole('dialog');
  await popup.locator('.MuiListItemButton-root').filter({ hasText: chart.title }).click();
  const recommendations = page.waitForResponse(r => r.url().includes('/template/recommend') && !r.url().includes('/dashboard'));
  await popup.locator('.MuiDialogActions-root button').last().click();
  const recommended = await (await recommendations).json();
  expect(recommended.status).toBe('SUCCESS');
  expect(recommended.data.length).toBeGreaterThan(0);
  await popup.getByText(recommended.data[0].title, { exact: true }).click();
  await popup.locator('.MuiDialogActions-root button').last().click();
  await expect(popup).toHaveCount(0);
  await numericView(page, chart.title);
  const title = unique();
  await page.locator('#userDashboardName').fill(title);
  await saveForm(page, '/dashboard');
  const saved = await savedByTitle(user, 'dashboard', title);
  expect(saved.widgets.map((item: any) => item.id)).toEqual([chart.id]);
  expect(saved.layout.map((item: any) => Number(item.i))).toEqual([chart.id]);
  await page.goto(`/dashboard/${saved.id}`);
  await numericView(page, title);
});

async function enableShare(page: Page, user: Actor, board: any) {
  await page.goto(`/dashboard/${board.id}`);
  await numericView(page, board.title);
  await page.getByRole('button', { name: '공유', exact: true }).click();
  const popup = page.locator('#simple-popover');
  await expect(popup).toBeVisible();
  const date = popup.locator('input[placeholder="YYYY.MM.DD."]');
  await expect(date).toHaveCount(1);
  await expect(date).toBeVisible();
  await date.fill('2030.12.31.');
  await date.press('Tab');
  await expect(date).toHaveValue('2030.12.31.');
  const posted = page.waitForRequest(r => r.url().endsWith(`/share-url/share-on/${board.id}`) && r.method() === 'POST');
  const pending = page.waitForResponse(r => r.url().endsWith(`/share-url/share-on/${board.id}`) && r.request().method() === 'POST');
  await popup.locator('form button[type="submit"]').click();
  expect((await posted).postDataJSON().endDate).toBe('12/31/2030');
  expect((await pending).status()).toBe(201);
  const saved = await persisted(user, 'dashboard', board.id);
  expect(saved.shareYn).toBe('Y');
  expect(typeof saved.uuid).toBe('string');
  const url = `${origin}/share/${saved.uuid}`;
  const embed = `<iframe src="${origin}/embed/${saved.uuid}" width="100%" height="600" frameborder="0"></iframe>`;
  await expect(popup.locator('input')).toHaveValue(url);
  await expect(popup.locator('textarea').first()).toHaveValue(embed);
  return { saved, url, embed };
}

test('SHARE-01 browser popup enable exposes current-origin URLs and persisted active state', async ({ page }) => {
  const { user, board } = await boardFixture(page);
  const share = await enableShare(page, user, board);
  await page.reload();
  await page.getByRole('button', { name: '공유중', exact: true }).click();
  await expect(page.locator('#simple-popover input')).toHaveValue(share.url);
  expect((await persisted(user, 'dashboard', board.id)).shareYn).toBe('Y');
});

test('SHARE-02 independent anonymous share and embed show exact title and 500', async ({ page, browser }, info) => {
  const { user, board } = await boardFixture(page);
  const share = await enableShare(page, user, board);
  for (const surface of ['share', 'embed']) {
    const context = await browser.newContext({ baseURL: BASE });
    const anonymous = await context.newPage();
    const errors: string[] = [];
    anonymous.on('pageerror', error => errors.push(error.name));
    await language(anonymous);
    await anonymous.goto(`/${surface}/${share.saved.uuid}`);
    await numericView(anonymous, board.title);
    await tokenAbsent(anonymous);
    if (surface === 'embed') await expect(anonymous.locator('nav.MuiAppBar-root')).toHaveCount(0);
    expect(errors).toEqual([]);
    await evidence(anonymous, info, `SHARE-02-${surface}`, { dashboardId: board.id });
    await context.close();
  }
});

test('SHARE-03 browser revocation denies both previously viewed anonymous URLs immediately', async ({ page, browser }) => {
  const { user, board } = await boardFixture(page);
  const share = await enableShare(page, user, board);
  const contexts = await Promise.all([browser.newContext({ baseURL: BASE }), browser.newContext({ baseURL: BASE })]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const errors: string[] = [];
  for (const [index, anonymous] of pages.entries()) {
    anonymous.on('pageerror', exception => errors.push(exception.name));
    await language(anonymous);
    await anonymous.goto(`/${index === 0 ? 'share' : 'embed'}/${share.saved.uuid}`);
    await numericView(anonymous, board.title);
  }
  const revoked = page.waitForResponse(r => r.url().endsWith(`/share-url/share-off/${board.id}`));
  await page.locator('#simple-popover form button[type="submit"]').click();
  expect((await revoked).status()).toBe(201);
  expect((await persisted(user, 'dashboard', board.id)).shareYn).toBe('N');
  for (const anonymous of pages) {
    await anonymous.reload();
    await expect(anonymous.locator('body')).toContainText(/expired|unavailable|not found|Failed|기간|불가/i);
    await expect(anonymous.locator('.react-grid-item')).toHaveCount(0);
    await expect(anonymous.getByText('500', { exact: true })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  for (const context of contexts) await context.close();
});

test('SHARE-07 actual link/embed copy and labeled clipboard-denied fault injection', async ({ page, context }) => {
  const { user, board } = await boardFixture(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const share = await enableShare(page, user, board);
  const copies = page.locator('#simple-popover').getByRole('button', { name: 'Copy', exact: true });
  await copies.first().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(share.url);
  await confirm(page);
  await page.getByRole('button', { name: '공유중', exact: true }).click();
  await copies.last().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(share.embed);
  await confirm(page);
  await page.getByRole('button', { name: '공유중', exact: true }).click();
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: () => Promise.reject(new DOMException('QA clipboard-denied fault injection', 'NotAllowedError')) }));
  await copies.first().click();
  await feedback(page, /Failed|Unable|copy/i);
  await closeError(page);
  await page.getByRole('button', { name: '공유중', exact: true }).click();
  await copies.last().click();
  await feedback(page, /Failed|Unable|copy/i);
});

test('AI-07 real local-provider SQL assistant inserts immutable SQL, Run 500, error preserves editor', async ({ page }) => {
  const user = await authenticated(page);
  const source = await upload(user);
  await provider('normal');
  try {
    await page.goto(`/data/set/create/${source.id}`);
    await page.getByPlaceholder('e.g., Show daily sales totals for last month').fill('Sum the test amount values');
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    await expect.poll(() => aceValue(page)).toBe(GOLD.aggregateSql);
    await runDataset(page);
    await provider('http-error');
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    await expect(errorSurface(page)).toBeVisible();
    expect(await aceValue(page)).toBe(GOLD.aggregateSql);
    await closeError(page);
    await provider('normal');
    await runDataset(page);
  } finally { await provider('normal'); }
});

test('AI-08 real insight action literal local fixture and unavailable-provider feedback', async ({ page }, info) => {
  const { board } = await boardFixture(page);
  await provider('normal');
  try {
    await page.goto(`/dashboard/${board.id}`);
    await page.getByRole('button', { name: 'AI Insights', exact: true }).click();
    await expect(page.getByText('- 로컬 계약 검증 결과입니다.\n- 테스트 매출 합계는 500입니다.\n총평: 모델 품질 평가는 아닙니다.', { exact: true })).toBeVisible();
    await provider('http-error');
    await page.getByRole('button', { name: 'AI Insights', exact: true }).click();
    await expect(errorSurface(page)).toBeVisible();
    await closeError(page);
    await expect(page.getByRole('button', { name: 'AI Insights', exact: true })).toBeEnabled();
    await provider('normal');
    const retried = page.waitForResponse(r => r.url().endsWith(`/ai/dashboard-insight/${board.id}`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'AI Insights', exact: true }).click();
    const recovered = await savedResponse(await retried);
    expect(recovered.insight).toBe('- 로컬 계약 검증 결과입니다.\n- 테스트 매출 합계는 500입니다.\n총평: 모델 품질 평가는 아닙니다.');
    await expect(page.getByText(recovered.insight, { exact: true })).toBeVisible();
    await evidence(page, info, 'AI-08-normal-provider-retry', { dashboardId: board.id, insight: recovered.insight });
  } finally { await provider('normal'); }
});

test('RELIABILITY-04 labeled failed-network API fault clears overlay then navigation recovers', async ({ page }) => {
  const { chart } = await numericFixture(page);
  await page.route(`${API}/database/data*`, route => route.abort('failed'));
  await page.goto(`/widget/${chart.id}`);
  await feedback(page, /Failed|fetch|database/i);
  await healthyPage(page);
  await expect(page.locator('body')).toContainText('Failed to load the widget.');
  await page.unroute(`${API}/database/data*`);
  await page.goto('/dashboard');
  await page.goto(`/widget/${chart.id}`);
  await numericView(page, chart.title);
  await healthyPage(page);
});

test('RELIABILITY-06 owned encrypted-config corruption leaves healthy UI loadable and repair recovers', async ({ page }, info) => {
  const { user, source, board } = await boardFixture(page);
  const healthy = await upload(user);
  const control = await request.newContext({ baseURL: 'http://127.0.0.1:4300' });
  expect(source.name.startsWith('qa_')).toBe(true);
  expect((await control.post('/corrupt-config', { data: { id: source.id } })).ok()).toBe(true);
  try {
    await page.goto('/data');
    await expect(page.locator('li').filter({ hasText: healthy.name })).toBeVisible();
    await page.locator('li').filter({ hasText: source.name }).click();
    await expect(page.locator('body')).toContainText(/error|failed|invalid|unavailable/i);
    await page.locator('li').filter({ hasText: healthy.name }).click();
    await expect(page.locator('li').filter({ hasText: 'uploaded_data' })).toBeVisible();
    await page.goto('/dashboard');
    await expect(await boardItem(page, 'dashboard', board.id)).toContainText(board.title);
    await healthyPage(page);
    await evidence(page, info, 'RELIABILITY-06-corrupt-owned-config', { corruptSourceId: source.id, healthySourceId: healthy.id, dashboardId: board.id });
  } finally {
    expect((await control.post('/restore-config', { data: { id: source.id } })).ok()).toBe(true);
    await control.dispose();
  }
  expect((await execute(user, source.id)).datas).toEqual([{ total: GOLD.sumAmount }]);
  await page.goto(`/dashboard/${board.id}`);
  await numericView(page, board.title);
});

test('NAV-01 visible language selector actually switches and survives reload', async ({ page }) => {
  await authenticated(page);
  await page.goto('/dashboard');
  const languageSelect = page.locator('nav.MuiAppBar-root .MuiSelect-select:visible');
  const dashboardLink = page.locator('nav.MuiAppBar-root a.MuiButton-root[href="/dashboard"]:visible');
  await expect(languageSelect).toHaveCount(1);
  await expect(languageSelect).toBeVisible();
  await expect(dashboardLink).toHaveCount(1);
  await select(page, languageSelect, '한국어');
  await expect(dashboardLink).toHaveText('대시보드');
  await page.reload();
  await expect(languageSelect).toHaveText('한국어');
  await expect(dashboardLink).toHaveText('대시보드');
  await select(page, languageSelect, 'English');
  await expect(dashboardLink).toHaveText('Dashboard');
  await page.reload();
  await expect(languageSelect).toHaveText('English');
  await expect(dashboardLink).toHaveText('Dashboard');
});

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  test(`NAV-02 operable login data metrics dashboard at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const user = await owner();
    const source = await upload(user);
    const chart = await widget(user, source.id);
    const board = await dashboard(user, chart.id);
    await signIn(page, user);
    await page.goto('/data');
    const sourceCard = page.locator('li').filter({ hasText: source.name });
    await sourceCard.scrollIntoViewIfNeeded();
    await sourceCard.click();
    await expect(page.locator('li').filter({ hasText: 'uploaded_data' })).toBeVisible();
    await page.goto('/data/metric');
    const add = page.getByRole('button', { name: 'Add metric', exact: true });
    await add.scrollIntoViewIfNeeded();
    await add.click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.goto('/dashboard');
    const item = await boardItem(page, 'dashboard', board.id);
    await item.click();
    await numericView(page, board.title);
    await expect(page.getByRole('button', { name: '공유', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '공유', exact: true }).click();
    await expect(page.locator('#simple-popover form button')).toBeVisible();
    await healthyPage(page);
    await evidence(page, info, `NAV-02-${viewport.width}`);
  });
}

test('NAV-03 browser back forward missing route and deep link reload remain authenticated', async ({ page }) => {
  const { chart, board } = await boardFixture(page);
  await page.goto(`/widget/${chart.id}`);
  await numericView(page, chart.title);
  await page.goto(`/dashboard/${board.id}`);
  await numericView(page, board.title);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/widget/${chart.id}$`));
  await numericView(page, chart.title);
  await page.goForward();
  await numericView(page, board.title);
  await page.reload();
  await numericView(page, board.title);
  await page.goto('/qa-route-does-not-exist');
  await expect(page.locator('body')).toContainText(/404|not found/i);
  await healthyPage(page);
  await page.goBack();
  await numericView(page, board.title);
});

for (const resource of ['dataset', 'database', 'widget', 'dashboard']) {
  test(`NAV-04 ${resource} actual create/edit cancellation leaves inventory and persisted state unchanged`, async ({ page }) => {
    const { user, source, chart, board } = await boardFixture(page);
    const before = await inventory(user, resource);
    const title = unique();
    await page.goto('/data');
    if (resource === 'dataset') {
      await page.goto(`/data/set/modify/${chart.datasetId}`);
      await page.locator('#userSetName').fill(title);
      await ace(page, GOLD.emptySql);
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      expect((await persisted(user, 'dataset', chart.datasetId)).query).toBe(GOLD.rowsSql);
    } else if (resource === 'database') {
      await page.goto('/data/source/create');
      await selectSqliteType(page);
      await page.locator('input[name="name"]').fill(title);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    } else if (resource === 'widget') {
      await page.goto(`/widget/modify?id=${chart.id}`);
      await page.locator('#title').fill(title);
      await page.getByRole('link', { name: 'Widget', exact: true }).last().click();
      expect((await persisted(user, 'widget', chart.id)).title).toBe(chart.title);
    } else {
      await page.goto(`/dashboard/modify?id=${board.id}`);
      await page.locator('#userDashboardName').fill(title);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      expect((await persisted(user, 'dashboard', board.id)).title).toBe(board.title);
    }
    expect((await inventory(user, resource)).map((item: any) => item.id)).toEqual(before.map((item: any) => item.id));
    expect((await execute(user, source.id)).datas).toEqual([{ total: GOLD.sumAmount }]);
    await page.goto(`/dashboard/${board.id}`);
    await numericView(page, board.title);
  });
}
