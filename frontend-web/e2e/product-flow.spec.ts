import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { API, USER, authHeaders, confirmAction, createdId, createResponse, login, removeOwned } from './core-helpers';
import { accountMenu, menuItem, navLink } from './ui-locators';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
});

test.describe('제품 핵심 플로우', () => {
  test('잘못된 비밀번호 오류 → 로그인 성공 → 로그아웃', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('User ID').fill(USER.userId);
    await page.getByLabel(/^Password\s*\*?$/).fill('WrongPass1!');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.getByText(/^(ID 또는 비밀번호가 일치하지 않습니다\.|Invalid ID or password\.)$/)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel(/^Password\s*\*?$/).fill(USER.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(navLink(page, 'Dashboard')).toBeVisible();
    await accountMenu(page).click();
    await menuItem(page, /로그아웃|Sign out|Logout/).click();
    await confirmAction(page);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('User ID')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('UI 위젯 → 대시보드 생성 → 무인증 공개 공유와 임베드', async ({ page, browser, baseURL }) => {
    test.setTimeout(90000);
    await login(page);
    const headers = await authHeaders(page);
    const suffix = randomUUID();
    const widgetTitle = `E2E amount ${suffix}`;
    const dashboardTitle = `E2E dashboard ${suffix}`;
    let widgetId: number;
    let dashboardId: number;
    try {
      const sourceList = page.waitForResponse(
        r => new URL(r.url()).pathname === '/v1/database' && r.request().method() === 'GET',
      );
      await page.goto('/widget/create');
      const sources = (await (await sourceList).json()).data;
      const salesSources = sources.filter((source: { name: string }) => source.name === 'sales');
      // Resolve the existing uploaded fixture from the UI's actual source list.
      const sourceIndex = salesSources.findIndex(
        (source: { description: string; engine: string }) =>
          source.description === 'File upload: sales.csv' && source.engine === 'duckdb',
      );
      expect(sourceIndex, 'generated sales upload must be provisioned').toBeGreaterThanOrEqual(0);
      const source = salesSources[sourceIndex];
      await page.getByText('sales', { exact: true }).nth(sourceIndex).click();
      await page.getByText('uploaded_data', { exact: true }).click();
      const next = page.getByRole('button', { name: /^(다음|Next)$/ });
      await expect(next).toBeEnabled();
      await next.click();
      await page.getByText('숫자판', { exact: true }).click();
      await next.click();
      await page.locator('#field').click();
      await page.getByRole('option', { name: 'amount', exact: true }).click();
      await page.locator('#title').fill(widgetTitle);
      await expect(page.getByText(/^298,?250$/)).toBeVisible();
      await page.getByRole('button', { name: /^(저장|Save)$/ }).click();
      const widgetCreated = createResponse(page, 'widget');
      await confirmAction(page);
      const widgetResponse = await widgetCreated;
      widgetId = await createdId(widgetResponse);
      expect(widgetResponse.request().postDataJSON()).toMatchObject({
        databaseId: source.id,
        tableName: 'uploaded_data',
        option: { content: { field: 'amount', aggregation: 'sum' } },
      });
      await expect(page).toHaveURL(/\/widget$/);
      await expect(page.getByText(widgetTitle, { exact: true })).toBeVisible();

      await page.goto('/dashboard/create');
      await page.locator('#userDashboardName').fill(dashboardTitle);
      await page.getByRole('button', { name: /^(위젯 추가|Add widgets?)$/i }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: widgetTitle, exact: true }).click();
      await dialog.getByRole('button', { name: /^(위젯 추가|Add widgets?)$/i }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText(widgetTitle, { exact: true })).toBeVisible();
      await expect(page.getByText(/^298,?250$/)).toBeVisible();
      await page.getByRole('button', { name: /^(저장|Save)$/ }).click();
      const dashboardCreated = createResponse(page, 'dashboard');
      await confirmAction(page);
      dashboardId = await createdId(await dashboardCreated);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByText(dashboardTitle, { exact: true })).toBeVisible();

      // Share picker UI is covered by the extended suite; enable only our dashboard via API.
      const share = await page.request.post(`${API}/share-url/share-on/${dashboardId}`, {
        headers,
        data: { userId: USER.userId, endDate: '12/31/2030' },
      });
      expect(share.ok()).toBe(true);
      const { uuid } = await share.json();
      expect(uuid).toEqual(expect.any(String));
      expect(uuid.length).toBeGreaterThan(0);
      const publicContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const publicPage = await publicContext.newPage();
        for (const route of ['share', 'embed']) {
          await publicPage.goto(`/${route}/${uuid}`);
          expect(await publicPage.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
          await expect(publicPage.getByText(dashboardTitle, { exact: true })).toBeVisible({ timeout: 15000 });
          await expect(publicPage.getByText(widgetTitle, { exact: true })).toBeVisible();
          await expect(publicPage.getByText(/^298,?250$/)).toBeVisible({ timeout: 15000 });
          if (route === 'embed') await expect(navLink(publicPage, 'Dashboard')).toHaveCount(0);
        }
      } finally {
        await publicContext.close();
      }
    } finally {
      try {
        if (dashboardId) {
          // Explicitly stop only the live share created by this test before reviewed deletion.
          const stopped = await page.request.post(`${API}/share-url/share-off/${dashboardId}`, { headers });
          expect(stopped.ok()).toBe(true);
        }
        await removeOwned(page, headers, 'dashboard', dashboardId);
      } finally {
        await removeOwned(page, headers, 'widget', widgetId);
      }
    }
  });
});
