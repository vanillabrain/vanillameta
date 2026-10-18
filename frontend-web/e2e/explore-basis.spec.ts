import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { API, authHeaders, createResponse, createdId, login, removeOwned } from './core-helpers';

// Compare CSV data and decoded JSON context; JSON property order is not a business difference.
function csvContent(csv: string) {
  const stable = (value: any): any =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map(key => [key, stable(value[key])]),
        )
      : value;
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  const text = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(cell.replace(/\r$/, ''));
      cell = '';
      if (char === '\n') {
        rows.push(row);
        row = [];
      }
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map(row =>
    row[0] !== 'condition'
      ? row
      : row.map(value => {
          try {
            return JSON.stringify(stable(JSON.parse(value)));
          } catch {
            return value;
          }
        }),
  );
}

test('검토 조건 명시 적용 → 비교·Pivot·CSV → 보기 reload → 지표 변경 차단', async ({ page }, info) => {
  test.setTimeout(120000);
  expect(process.env.QA_RUN_ROOT).toBeTruthy();
  await login(page);
  const headers = await authHeaders(page);
  expect(
    (
      await page.request.post(`${API}/enterprise/organizations`, {
        headers,
        data: { name: `Synthetic basis ${randomUUID()}` },
      })
    ).status(),
  ).toBe(201);
  let sourceId: number | undefined;
  let metricId: number | undefined;
  let viewId: number | undefined;
  let dashboardId: number | undefined;
  let jobId: number | undefined;
  const name = `Basis ${randomUUID()}`;
  try {
    const upload = await page.request.post(`${API}/database/upload`, {
      headers,
      multipart: {
        file: {
          name: 'basis.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(
            'category,channel,amount,created_at\nA,App,100,2026-01-03\nA,Site,200,2026-01-04\nB,App,300,2026-01-03\nC,App,400,2026-01-04\nA,App,10,2026-01-01\nB,App,30,2026-01-02\n',
          ),
        },
      },
    });
    sourceId = await createdId(upload as any);
    metricId = await createdId(
      (await page.request.post(`${API}/bi/metrics`, {
        headers,
        data: {
          sourceId,
          label: 'Basis Amount',
          aggregation: 'SUM',
          column: 'amount',
          unit: '',
          decimalPlaces: 0,
          numberNotation: 'plain',
        },
      })) as any,
    );
    const raw = await page.request.post(`${API}/bi/source-conditions/read`, { headers, data: { sourceId } });
    expect(raw.ok()).toBe(true);
    const original = (await raw.json()).data;
    const catalogResponse = await page.request.post(`${API}/bi/explore/catalog`, { headers, data: { sourceId } });
    expect(catalogResponse.ok()).toBe(true);
    const fileRevision = (await catalogResponse.json()).data.sourceRevision;
    expect(fileRevision).not.toBe(original.sourceRevision);
    const definition = {
      include: {
        kind: 'group',
        operator: 'or',
        children: ['A', 'B'].map(value => ({ kind: 'predicate', column: 'category', operator: 'eq', values: [value] })),
      },
      exclude: { kind: 'predicate', column: 'channel', operator: 'eq', values: ['Site'] },
    };
    const stored = await page.request.post(`${API}/bi/source-conditions/save`, {
      headers,
      data: {
        sourceId,
        sourceRevision: original.sourceRevision,
        version: original.version,
        definition,
      },
    });
    expect(stored.ok()).toBe(true);
    let sourceWrites = 0;
    page.on('request', request => {
      if (request.url().endsWith('/bi/source-conditions/save')) sourceWrites++;
    });
    await page.goto(`/explore/source?sourceId=${sourceId}`);
    await page.getByRole('button', { name: '조건과 분석 범위', exact: true }).click();
    const apply = page.getByRole('button', { name: '이 분석에 조건 적용', exact: true });
    await expect(apply).toBeDisabled();
    await page.getByRole('button', { name: '건수 미리보기', exact: true }).click();
    await expect(page.getByRole('status', { name: '조건 건수 미리보기' })).toContainText('최종 4건');
    const applied = page.waitForResponse(
      response => response.url().endsWith('/bi/explore/query') && !!response.request().postDataJSON()?.conditions,
    );
    await apply.click();
    const appliedResponse = await applied;
    expect(Number((await appliedResponse.json()).data.kpis[0].value)).toBe(440);
    expect(appliedResponse.request().postDataJSON().conditions).toEqual({
      sourceRevision: fileRevision,
      definition,
    });
    await page.getByRole('button', { name: '사용자 지정', exact: true }).click();
    await page.getByLabel('시작일', { exact: true }).fill('2026-01-03');
    await page.getByLabel('종료일', { exact: true }).fill('2026-01-04');
    const compared = page.waitForResponse(
      response =>
        response.url().endsWith('/bi/explore/query') && response.request().postDataJSON()?.comparePrevious === true,
    );
    await page.getByRole('button', { name: '이전 기간 비교', exact: true }).click();
    const comparison = (await (await compared).json()).data;
    expect(Number(comparison.kpis[0].value)).toBe(400);
    expect(comparison.measureVersions[String(metricId)]).toBeDefined();
    await page.getByRole('button', { name: '고급 Pivot', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Pivot 결과' })).toContainText('400');
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await page.getByLabel('새 보기 이름').fill(name);
    const saved = createResponse(page, 'bi/explore/views/create');
    await page.getByRole('button', { name: '현재 조건 저장', exact: true }).click();
    const saveResponse = await saved;
    viewId = await createdId(saveResponse);
    expect((await saveResponse.json()).data.state.conditions).toEqual({
      sourceRevision: fileRevision,
      definition,
    });
    await page.reload();
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await page.getByLabel('저장한 탐색 보기').selectOption(String(viewId));
    const restored = page.waitForResponse(
      response => response.url().endsWith('/bi/explore/pivot') && !!response.request().postDataJSON()?.conditions,
    );
    await page.getByRole('button', { name: '보기 열기', exact: true }).click();
    const result = (await (await restored).json()).data;
    expect(Number(result.grandTotal[0].value)).toBe(400);
    await page.getByRole('button', { name: '내보내기 ▾', exact: true }).click();
    const exported = createResponse(page, 'bi/explore/export');
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV 다운로드', exact: true }).click();
    const response = await exported;
    expect(response.ok()).toBe(true);
    expect(response.request().postDataJSON().query).toMatchObject({
      conditions: { sourceRevision: fileRevision, definition },
      expectedMeasureVersions: result.measureVersions,
    });
    const csv = (await response.json()).data.csv;
    expect(csv).toContain('"400"');
    expect(csv).toContain('"40"');
    expect(await readFile((await (await downloaded).path())!, 'utf8')).toBe(csv);
    const jobs = page.getByRole('region', { name: '영속 CSV 파일 작업', exact: true });
    await jobs.getByRole('button', { name: '파일 작업 펼치기', exact: true }).click();
    const queued = createResponse(page, 'bi/export-jobs');
    await jobs.getByRole('button', { name: '현재 조건으로 작업 접수', exact: true }).click();
    const jobResponse = await queued;
    expect(jobResponse.ok()).toBe(true);
    const queuedJob = await jobResponse.json();
    jobId = queuedJob.id;
    expect(queuedJob.measureVersions).toEqual(result.measureVersions);
    expect(queuedJob.payload.query.conditions).toEqual({ sourceRevision: fileRevision, definition });
    const ran = createResponse(page, `bi/export-jobs/${jobId}/run`);
    await jobs.getByRole('button', { name: 'CSV 만들기', exact: true }).click();
    expect(['running', 'ready']).toContain((await (await ran).json()).status);
    await expect
      .poll(async () => (await (await page.request.get(`${API}/bi/export-jobs/${jobId}`, { headers })).json()).status)
      .toBe('ready');
    await jobs.getByRole('button', { name: '선택 작업 다시 읽기', exact: true }).click();
    await expect(jobs.getByRole('button', { name: '고정 파일 받기', exact: true })).toBeEnabled();
    const fixedDownload = page.waitForEvent('download');
    await jobs.getByRole('button', { name: '고정 파일 받기', exact: true }).click();
    const fixedCsv = await readFile((await (await fixedDownload).path())!, 'utf8');
    expect(csvContent(fixedCsv)).toEqual(csvContent(csv));
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: info.outputPath(`basis-${width}.png`), fullPage: true });
      const geometry = await page.getByRole('button', { name: 'CSV 다운로드', exact: true }).evaluate(el => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return { width: box.width, height: box.height, fontSize: style.fontSize };
      });
      expect([32, 36]).toContain(geometry.height);
      expect(geometry.fontSize).toBe('14px');
      await writeFile(
        info.outputPath(`layout-${width}.json`),
        JSON.stringify({ viewport: width, overflow: 0, csvButton: geometry }, null, 2),
      );
    }
    const dashboard = await page.request.post(`${API}/bi/dashboards`, {
      headers,
      data: {
        sourceId,
        metricId,
        title: name,
        chart: 'number',
      },
    });
    expect(dashboard.ok()).toBe(true);
    const savedDashboard = (await dashboard.json()).data;
    dashboardId = savedDashboard.id;
    const changed = await page.request.post(`${API}/ai/metric-change/save`, {
      headers,
      data: {
        dashboardId,
        metricId,
        selectedWidget: 0,
        expectedDefinitionVersion: result.measureVersions[String(metricId)],
        expectedRevision: savedDashboard.revision,
        calculation: { aggregation: 'MAX', column: 'amount' },
      },
    });
    expect(changed.ok()).toBe(true);
    expect((await changed.json()).status).toBe('SUCCESS');
    const refused = createResponse(page, 'bi/explore/export');
    await page.getByRole('button', { name: 'CSV 다운로드', exact: true }).click();
    expect((await refused).status()).toBe(409);
    const historical = await page.request.get(`${API}/bi/export-jobs/${jobId}/file`, { headers });
    expect(historical.ok()).toBe(true);
    expect((await historical.json()).csv).toBe(fixedCsv);
    expect(sourceWrites).toBe(0);
  } finally {
    if (jobId) {
      const current = await page.request.get(`${API}/bi/export-jobs/${jobId}`, { headers });
      if (current.ok()) {
        const job = await current.json();
        if (['queued', 'running', 'failed', 'ready'].includes(job.status))
          expect(
            (
              await page.request.post(`${API}/bi/export-jobs/${jobId}/cancel`, {
                headers,
                data: { expectedVersion: job.version },
              })
            ).ok(),
          ).toBe(true);
      }
    }
    if (viewId && sourceId)
      await page.request.post(`${API}/bi/explore/views/remove`, { headers, data: { sourceId, viewId } });
    await removeOwned(page, headers, 'dashboard', dashboardId);
    await removeOwned(page, headers, 'metric', metricId);
    if (sourceId) {
      // Both generated dataset versions belong to this test's unique upload in the isolated store.
      const ownSource = await page.request.get(`${API}/database/${sourceId}`, { headers });
      expect(ownSource.ok()).toBe(true);
      for (const dataset of (await ownSource.json()).data.datasets) {
        expect(dataset.databaseId).toBe(sourceId);
        await removeOwned(page, headers, 'dataset', dataset.id);
      }
    }
    await removeOwned(page, headers, 'database', sourceId);
  }
});
