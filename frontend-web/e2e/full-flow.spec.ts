import { expect, test, Page } from '@playwright/test';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { API, authHeaders, confirmAction, createdId, createResponse, login, removeOwned } from './core-helpers';

async function openSalesFile(page: Page) {
  await login(page);
  await page.goto('/data/file');
  await expect(page.getByRole('button', { name: /^(파일 선택|Choose file)$/ })).toBeEnabled({ timeout: 60000 });
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures/generated/sales.csv'));
  await expect(page.getByText(/sales\.csv → uploaded_data/)).toBeVisible();
  await expect(page.locator('.tui-grid-container')).toBeVisible({ timeout: 30000 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
});

test.describe('CSV 핵심 플로우', () => {
  test('CSV → 정확한 카테고리 SUM → 차트', async ({ page }) => {
    test.setTimeout(90000);
    await openSalesFile(page);
    await page
      .getByRole('textbox')
      .fill("SELECT category, SUM(amount) AS total FROM uploaded_data WHERE category = '도서' GROUP BY category");
    await page.getByRole('button', { name: /^(실행|Run)$/ }).click();
    const result = page.locator('.tui-grid-rside-area .tui-grid-body-area');
    // Wait for the SQL result to replace the uploaded preview before checking values.
    await expect(result.getByText('도서', { exact: true })).toHaveCount(1);
    await expect(result.getByText('도서', { exact: true })).toBeVisible();
    await expect(result.getByText('60550', { exact: true })).toBeVisible();
    const value = page
      .locator('.MuiFormControl-root')
      .filter({
        has: page.locator('.MuiInputLabel-root', { hasText: /^(값|Value)$/ }),
      })
      .getByRole('combobox');
    await value.click();
    await page.getByRole('option', { name: 'total', exact: true }).click();
    const chart = page
      .locator('.MuiFormControl-root')
      .filter({
        has: page.locator('.MuiInputLabel-root', { hasText: /^(차트|Chart)$/ }),
      })
      .getByRole('combobox');
    await chart.click();
    await page.getByRole('option', { name: /^(막대|Bar)$/ }).click();
    await expect(value).toHaveText('total');
    await expect(page.locator('.echarts-for-react canvas')).toBeVisible();
  });

  test('CSV → UI 데이터셋 저장 → API로 영속 정의 확인', async ({ page }) => {
    test.setTimeout(90000);
    await openSalesFile(page);
    const headers = await authHeaders(page);
    const title = `E2E sales dataset ${randomUUID()}`;
    let databaseId: number;
    let datasetId: number;
    try {
      const uploaded = createResponse(page, 'database/upload');
      await page.getByRole('button', { name: /^(데이터셋으로 저장|Save as dataset)$/ }).click();
      const response = await uploaded;
      databaseId = await createdId(response);
      expect((await response.json()).data).toMatchObject({ name: 'sales', tableName: 'uploaded_data', rows: 500 });
      await expect(page).toHaveURL(new RegExp(`/data/set/create/${databaseId}$`));
      await expect(page.locator('#databaseId')).toHaveText('sales');
      await page.locator('#userSetName').fill(title);
      await expect(page.locator('#codeInput')).toContainText('SELECT * FROM uploaded_data');
      const executed = createResponse(page, 'database/execute');
      await page.getByRole('button', { name: 'Run', exact: true }).click();
      const result = await (await executed).json();
      expect(result.status).toBe('SUCCESS');
      expect(result.datas).toHaveLength(500);
      expect(result.datas.reduce((sum: number, row: { amount: number }) => sum + Number(row.amount), 0)).toBe(298250);
      const save = page.getByRole('button', { name: /^(저장|Save)$/ });
      await expect(save).toBeEnabled();
      await save.click();
      const created = createResponse(page, 'dataset');
      await confirmAction(page);
      datasetId = await createdId(await created);
      await expect(page).toHaveURL(/\/data$/);
      const persisted = await page.request.get(`${API}/dataset/${datasetId}`, { headers });
      expect(persisted.ok()).toBe(true);
      expect(await persisted.json()).toMatchObject({
        status: 'SUCCESS',
        data: { id: datasetId, title, databaseId, query: 'SELECT * FROM uploaded_data' },
      });
    } finally {
      try {
        await removeOwned(page, headers, 'dataset', datasetId);
      } finally {
        await removeOwned(page, headers, 'database', databaseId);
      }
    }
  });
});
