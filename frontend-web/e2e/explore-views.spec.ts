import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { API, authHeaders, createResponse, createdId, login, removeOwned } from './core-helpers';

test('탐색·Pivot 조건 저장 → 새로고침 → 복원 → CSV 다운로드 → 삭제', async ({ page }) => {
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
          buffer: Buffer.from(
            'category,channel,amount,created_at\nA,App,100,2026-01-03\nA,Site,200,2026-01-04\nB,App,300,2026-01-03\n',
          ),
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
    await page.getByRole('button', { name: '내보내기 ▾', exact: true }).click();
    const exploreExport = createResponse(page, 'bi/explore/export');
    const exploreDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV 다운로드', exact: true }).click();
    const exploreResponse = await exploreExport;
    expect(exploreResponse.request().postDataJSON()).toMatchObject({
      mode: 'explore',
      query: { filters: savedState.filters, includeRows: false },
    });
    const exploreFile = await exploreDownload;
    const exploreCsv = (await exploreResponse.json()).data.csv;
    expect(await readFile((await exploreFile.path())!, 'utf8')).toBe(exploreCsv);
    expect(exploreCsv).toContain('"300"');
    expect(exploreCsv).not.toContain('"600"');
    const removed = createResponse(page, 'bi/explore/views/remove');
    await page.getByRole('button', { name: '보기 삭제', exact: true }).click();
    expect((await removed).ok()).toBe(true);
    viewId = undefined;
    await page.reload();
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await expect(page.getByLabel('저장한 탐색 보기')).toBeEnabled();
    await expect(page.getByRole('option', { name, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '고급 Pivot', exact: true }).click();
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
    await page.getByRole('button', { name: '내보내기 ▾', exact: true }).click();
    const pivotExport = createResponse(page, 'bi/explore/export');
    const pivotDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV 다운로드', exact: true }).click();
    const pivotResponse = await pivotExport;
    expect(pivotResponse.request().postDataJSON()).toMatchObject({
      mode: 'pivot',
      query: { rowColumns: ['category'], columnColumns: ['channel'] },
    });
    const pivotFile = await pivotDownload;
    const pivotCsv = (await pivotResponse.json()).data.csv;
    expect(await readFile((await pivotFile.path())!, 'utf8')).toBe(pivotCsv);
    expect(pivotCsv).toContain('"600"');
    expect(pivotCsv).toContain('"grand_total"');
    expect(pivotCsv).toContain('"cell"');
    const pivotRemoved = createResponse(page, 'bi/explore/views/remove');
    await page.getByRole('button', { name: '보기 삭제', exact: true }).click();
    expect((await pivotRemoved).ok()).toBe(true);
    viewId = undefined;

    // Version 3 keeps hierarchy expansion and server ordering across a real reload.
    await page.getByLabel('열 차원 1').selectOption('');
    await page.getByLabel('행 차원 2').selectOption('channel');
    await page.getByRole('button', { name: '행 계층 꺼짐', exact: true }).click();
    await page.getByLabel('행 정렬 기준').selectOption(String(metricId));
    await page.getByRole('button', { name: '행 정렬 방향', exact: true }).click();
    await page.getByRole('button', { name: 'A 펼치기', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Pivot 결과' })).toContainText('부분합');
    await expect(page.getByRole('button', { name: 'A 접기', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await page.getByLabel('새 보기 이름').fill(`${name} 계층`);
    const hierarchySaved = createResponse(page, 'bi/explore/views/create');
    await page.getByRole('button', { name: '현재 조건 저장', exact: true }).click();
    const hierarchySaveResponse = await hierarchySaved;
    viewId = await createdId(hierarchySaveResponse);
    expect((await hierarchySaveResponse.json()).data.state).toMatchObject({
      version: 3,
      pivot: {
        rowHierarchy: true,
        rowColumns: ['category', 'channel'],
        columnColumns: [],
        expandedRows: [['A']],
        rowSort: { by: 'value', direction: 'desc', measureId: metricId },
      },
    });
    await page.reload();
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await page.getByLabel('저장한 탐색 보기').selectOption(String(viewId));
    const hierarchyRestored = page.waitForResponse(
      response => response.url().endsWith('/bi/explore/pivot') && response.request().postDataJSON()?.rowHierarchy === true,
    );
    await page.getByRole('button', { name: '보기 열기', exact: true }).click();
    const hierarchyResponse = await hierarchyRestored;
    const hierarchyData = (await hierarchyResponse.json()).data;
    expect(hierarchyResponse.request().postDataJSON()).toMatchObject({
      rowSort: { by: 'value', direction: 'desc', measureId: metricId },
    });
    expect(hierarchyData.rowSubtotals.map((row: any) => row.tuple)).toEqual([['A'], ['B']]);
    expect(Number(hierarchyData.rowSubtotals[0].measures[0].value)).toBe(300);
    expect(Number(hierarchyData.rowSubtotals[1].measures[0].value)).toBe(300);
    await expect(page.getByRole('button', { name: 'A 접기', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('region', { name: 'Pivot 결과' })).toContainText('Site');
    await page.getByRole('button', { name: '내보내기 ▾', exact: true }).click();
    const hierarchyExport = createResponse(page, 'bi/explore/export');
    const hierarchyDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV 다운로드', exact: true }).click();
    const exportResponse = await hierarchyExport;
    expect(exportResponse.request().postDataJSON().query).not.toHaveProperty('expandedRows');
    const csv = (await exportResponse.json()).data.csv;
    expect(csv).toContain('"subtotal_total"');
    expect(csv).toContain('"subtotal_cell"');
    expect(await readFile((await (await hierarchyDownload).path())!, 'utf8')).toBe(csv);
    const hierarchyRemoved = createResponse(page, 'bi/explore/views/remove');
    await page.getByRole('button', { name: '보기 삭제', exact: true }).click();
    expect((await hierarchyRemoved).ok()).toBe(true);
    viewId = undefined;

    // Version 4 keeps the bucket axis and a selected time cell across a real reload.
    await page.getByLabel('열 차원 1').selectOption('created_at');
    await page.getByRole('button', { name: '시간 축 꺼짐', exact: true }).click();
    await expect(page.getByLabel('시간 집계')).toHaveValue('day');
    await page.getByRole('button', { name: '정렬 2026-01-03 Test Amount', exact: true }).click();
    await page.getByLabel('새 보기 이름').fill(`${name} 시간 셀`);
    const timeSaved = createResponse(page, 'bi/explore/views/create');
    await page.getByRole('button', { name: '현재 조건 저장', exact: true }).click();
    const timeSavedResponse = await timeSaved;
    viewId = await createdId(timeSavedResponse);
    const timeState = (await timeSavedResponse.json()).data.state;
    expect(timeState).toMatchObject({
      version: 4,
      pivot: {
        timeAxis: { column: 'created_at', grain: 'day', timeZone: 'UTC' },
        rowSort: { by: 'value', direction: 'desc', measureId: metricId, columnTuple: ['2026-01-03'] },
      },
    });
    await page.reload();
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await page.getByLabel('저장한 탐색 보기').selectOption(String(viewId));
    const timeRestored = page.waitForResponse(
      response =>
        response.url().endsWith('/bi/explore/pivot') && response.request().postDataJSON()?.timeAxis?.column === 'created_at',
    );
    await page.getByRole('button', { name: '보기 열기', exact: true }).click();
    const timeResponse = await timeRestored;
    expect(timeResponse.request().postDataJSON()).toMatchObject({
      timeAxis: timeState.pivot.timeAxis,
      rowSort: timeState.pivot.rowSort,
    });
    const timeData = (await timeResponse.json()).data;
    expect(timeData.columns).toEqual([['2026-01-03'], ['2026-01-04']]);
    expect(timeData.rowSubtotals.map((row: any) => row.tuple)).toEqual([['B'], ['A']]);
    await expect(page.getByLabel('시간 집계')).toHaveValue('day');
    await expect(page.getByRole('button', { name: '정렬 2026-01-03 Test Amount', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: '내보내기 ▾', exact: true }).click();
    const timeExport = createResponse(page, 'bi/explore/export');
    const timeDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV 다운로드', exact: true }).click();
    const timeExportResponse = await timeExport;
    expect(timeExportResponse.request().postDataJSON().query).toMatchObject({
      timeAxis: timeState.pivot.timeAxis,
      rowSort: timeState.pivot.rowSort,
    });
    const timeCsv = (await timeExportResponse.json()).data.csv;
    expect(timeCsv).toContain('timeAxis');
    expect(timeCsv).toContain('columnTuple');
    expect(await readFile((await (await timeDownload).path())!, 'utf8')).toBe(timeCsv);
    const timeRemoved = createResponse(page, 'bi/explore/views/remove');
    await page.getByRole('button', { name: '보기 삭제', exact: true }).click();
    expect((await timeRemoved).ok()).toBe(true);
    viewId = undefined;

    // Flat v5 groups the combined dimensions, rather than flattening a sparse Pivot grid.
    const flatQuery = page.waitForResponse(
      response => response.url().endsWith('/bi/explore/pivot') && response.request().postDataJSON()?.tableMode === 'flat',
    );
    await page.getByRole('button', { name: 'Flat', exact: true }).click();
    const flatResponse = await flatQuery;
    const flatData = (await flatResponse.json()).data;
    expect(flatResponse.request().postDataJSON()).toMatchObject({ tableMode: 'flat', rowHierarchy: false });
    expect(flatResponse.request().postDataJSON().rowSort).not.toHaveProperty('columnTuple');
    expect(flatData.rowColumns).toEqual(['created_at', 'category', 'channel']);
    expect(flatData.rows).toHaveLength(3);
    expect(flatData.columnColumns).toEqual([]);
    expect(Number(flatData.grandTotal[0].value)).toBe(600);
    await expect(page.getByRole('button', { name: 'Flat', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('새 보기 이름').fill(`${name} Flat`);
    const flatSaved = createResponse(page, 'bi/explore/views/create');
    await page.getByRole('button', { name: '현재 조건 저장', exact: true }).click();
    const flatSaveResponse = await flatSaved;
    viewId = await createdId(flatSaveResponse);
    const flatState = (await flatSaveResponse.json()).data.state;
    expect(flatState).toMatchObject({ version: 5, pivot: { tableMode: 'flat', rowHierarchy: false, expandedRows: [] } });
    await page.reload();
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await page.getByLabel('저장한 탐색 보기').selectOption(String(viewId));
    const flatRestored = page.waitForResponse(
      response => response.url().endsWith('/bi/explore/pivot') && response.request().postDataJSON()?.tableMode === 'flat',
    );
    await page.getByRole('button', { name: '보기 열기', exact: true }).click();
    expect((await (await flatRestored).json()).data.rows).toHaveLength(3);
    await expect(page.getByRole('button', { name: 'Flat', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '내보내기 ▾', exact: true }).click();
    const flatExport = createResponse(page, 'bi/explore/export');
    const flatDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV 다운로드', exact: true }).click();
    const flatExportResponse = await flatExport;
    expect(flatExportResponse.request().postDataJSON().query).toMatchObject({ tableMode: 'flat', rowHierarchy: false });
    const flatCsv = (await flatExportResponse.json()).data.csv;
    expect(flatCsv).toContain('tableMode');
    expect(flatCsv).toContain('flat');
    expect(flatCsv).not.toContain('subtotal_cell');
    expect(await readFile((await (await flatDownload).path())!, 'utf8')).toBe(flatCsv);
    const flatRemoved = createResponse(page, 'bi/explore/views/remove');
    await page.getByRole('button', { name: '보기 삭제', exact: true }).click();
    expect((await flatRemoved).ok()).toBe(true);
    viewId = undefined;
    await page.getByRole('button', { name: 'Pivot 테이블', exact: true }).click();
    await expect(page.getByLabel('열 차원 1')).toHaveValue('created_at');
  } finally {
    if (viewId && sourceId)
      await page.request.post(`${API}/bi/explore/views/remove`, { headers, data: { sourceId, viewId } });
    await removeOwned(page, headers, 'metric', metricId);
    await removeOwned(page, headers, 'database', sourceId);
  }
});
