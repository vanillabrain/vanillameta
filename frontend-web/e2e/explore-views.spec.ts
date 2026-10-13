import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { API, authHeaders, createResponse, createdId, login, removeOwned } from './core-helpers';

test('탐색·Pivot 조건 저장 → 새로고침 → 서버 보기 복원 → 삭제', async ({ page }) => {
  await login(page);
  const headers = await authHeaders(page);
  let sourceId: number | undefined;
  let metricId: number | undefined;
  let viewId: number | undefined;
  const name = `E2E 탐색 보기 ${randomUUID()}`;
  try {
    const upload = await page.request.post(`${API}/database/upload`, {
      headers,
      multipart: {
        file: {
          name: 'explore-views.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('category,channel,amount\nA,App,100\nA,Site,200\nB,App,300\n'),
        },
      },
    });
    sourceId = await createdId(upload as any);
    const metric = await page.request.post(`${API}/bi/metrics`, {
      headers,
      data: {
        sourceId,
        label: 'Test Amount',
        aggregation: 'SUM',
        column: 'amount',
        unit: '',
        decimalPlaces: 0,
        numberNotation: 'plain',
      },
    });
    metricId = await createdId(metric as any);
    await page.goto(`/explore/source?sourceId=${sourceId}`);
    await page.getByRole('button', { name: '필터 적용: category = A', exact: true }).click();
    await page.getByRole('button', { name: 'Model Data 펼치기', exact: true }).click();
    await expect(page.getByRole('button', { name: '필터 적용: category = A', exact: true })).toContainText('300');
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await page.getByLabel('새 보기 이름').fill(name);
    await expect(page.getByRole('button', { name: '현재 조건 저장', exact: true })).toBeEnabled();
    const saved = createResponse(page, 'bi/explore/views/create');
    await page.getByRole('button', { name: '현재 조건 저장', exact: true }).click();
    const saveResponse = await saved;
    viewId = await createdId(saveResponse);
    const savedState = (await saveResponse.json()).data.state;
    expect(savedState).toMatchObject({ version: 1, filters: [{ column: 'category', values: ['A'] }], includeRows: true });
    await page.reload();
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await expect(page.getByLabel('저장한 탐색 보기')).toBeEnabled();
    await page.getByLabel('저장한 탐색 보기').selectOption(String(viewId));
    const loaded = createResponse(page, 'bi/explore/views/load');
    const restored = page.waitForResponse(
      response =>
        response.url().endsWith('/bi/explore/query') &&
        response
          .request()
          .postDataJSON()
          ?.filters?.some((filter: any) => filter.column === 'category'),
    );
    await page.getByRole('button', { name: '보기 열기', exact: true }).click();
    expect((await (await loaded).json()).data.state).toEqual(savedState);
    const queryResponse = await restored;
    const data = (await queryResponse.json()).data;
    expect(Number(data.kpis[0].value)).toBe(300);
    expect(data.details.totalRows).toBe('2');
    expect(queryResponse.request().postDataJSON()).toMatchObject({
      filters: savedState.filters,
      page: 0,
      includeRows: true,
    });
    await expect(page.getByText(`“${name}” 조건을 복원했습니다.`, { exact: true })).toBeVisible();
    const removed = createResponse(page, 'bi/explore/views/remove');
    await page.getByRole('button', { name: '보기 삭제', exact: true }).click();
    expect((await removed).ok()).toBe(true);
    viewId = undefined;
    await page.reload();
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await expect(page.getByLabel('저장한 탐색 보기')).toBeEnabled();
    await expect(page.getByRole('option', { name, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Pivot', exact: true }).click();
    await page.getByLabel('열 차원 1').selectOption('channel');
    await expect(page.getByRole('region', { name: 'Pivot 결과' })).toContainText('App');
    await expect(page.getByRole('region', { name: 'Pivot 결과' })).toContainText('600');
    await page.getByLabel('새 보기 이름').fill(`${name} Pivot`);
    await expect(page.getByRole('button', { name: '현재 조건 저장', exact: true })).toBeEnabled();
    const pivotSaved = createResponse(page, 'bi/explore/views/create');
    await page.getByRole('button', { name: '현재 조건 저장', exact: true }).click();
    const pivotSaveResponse = await pivotSaved;
    viewId = await createdId(pivotSaveResponse);
    const pivotState = (await pivotSaveResponse.json()).data.state;
    expect(pivotState).toMatchObject({
      version: 2,
      pivot: { enabled: true, rowColumns: ['category'], columnColumns: ['channel'] },
    });
    await page.reload();
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await expect(page.getByLabel('저장한 탐색 보기')).toBeEnabled();
    await page.getByLabel('저장한 탐색 보기').selectOption(String(viewId));
    const pivotRestored = page.waitForResponse(
      response =>
        response.url().endsWith('/bi/explore/pivot') &&
        response.request().postDataJSON()?.columnColumns?.includes('channel'),
    );
    await page.getByRole('button', { name: '보기 열기', exact: true }).click();
    const pivotData = (await (await pivotRestored).json()).data;
    expect(Number(pivotData.grandTotal[0].value)).toBe(600);
    const a = pivotData.rows.findIndex((row: string[]) => row[0] === 'A');
    const app = pivotData.columns.findIndex((column: string[]) => column[0] === 'App');
    expect(Number(pivotData.cells.find((cell: any) => cell.row === a && cell.column === app).measures[0].value)).toBe(100);
    await expect(page.getByRole('region', { name: 'Pivot 결과' })).toBeVisible();
    await expect(page.getByLabel('열 차원 1')).toHaveValue('channel');
    const pivotRemoved = createResponse(page, 'bi/explore/views/remove');
    await page.getByRole('button', { name: '보기 삭제', exact: true }).click();
    expect((await pivotRemoved).ok()).toBe(true);
    viewId = undefined;
  } finally {
    if (viewId && sourceId)
      await page.request.post(`${API}/bi/explore/views/remove`, { headers, data: { sourceId, viewId } });
    await removeOwned(page, headers, 'metric', metricId);
    await removeOwned(page, headers, 'database', sourceId);
  }
});
