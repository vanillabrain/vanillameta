import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { API, authHeaders, createResponse, createdId, login, removeOwned } from './core-helpers';

test('업무 날짜 조건 → 저장·적용 → 보기 복구 → 최신 의미 명시 채택', async ({ page }, info) => {
  test.setTimeout(process.env.QA_REAL_CODEX === '1' ? 300000 : 120000);
  expect(process.env.QA_RUN_ROOT).toBeTruthy();
  const root = await mkdtemp(path.join(os.tmpdir(), 'vm-business-condition-'));
  const file = path.join(root, 'typed.parquet');
  const backendRequire = createRequire(path.resolve(process.cwd(), '../backend-api/package.json'));
  const { DuckDBInstance } = backendRequire('@duckdb/node-api');
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    await connection.run(
      "CREATE TABLE typed(category VARCHAR, amount INTEGER, business_day VARCHAR, event_time TIMESTAMP); INSERT INTO typed VALUES ('A',100,'2024/02/28',TIMESTAMP '2024-02-28'),('B',200,'2024/02/29',TIMESTAMP '2024-02-29'),('C',300,'2024/03/01',TIMESTAMP '2024-03-01')",
    );
    await connection.run(`COPY typed TO '${file.replace(/'/g, "''")}' (FORMAT PARQUET)`);
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
  await login(page);
  const headers = await authHeaders(page);
  let sourceId: number | undefined,
    metricId: number | undefined,
    viewId: number | undefined,
    adoptedViewId: number | undefined,
    dashboardId: number | undefined;
  const name = `Business meaning ${randomUUID()}`;
  const catalog = async (businessType: 'date' | 'category') => {
    const response = await page.request.post(`${API}/bi/source-catalog/read`, { headers, data: { sourceId } });
    expect(response.ok()).toBe(true);
    const current = (await response.json()).data;
    const body = {
      sourceId,
      sourceRevision: current.sourceRevision,
      version: current.version,
      label: current.label,
      description: current.description,
      columns: current.columns.map(({ type, ...column }: any) =>
        column.column === 'business_day'
          ? { ...column, businessType, dateFormat: businessType === 'date' ? 'YYYY/MM/DD' : '' }
          : column,
      ),
    };
    const preview = await page.request.post(`${API}/bi/source-catalog/preview`, { headers, data: body });
    expect(preview.ok(), await preview.text()).toBe(true);
    const saved = await page.request.post(`${API}/bi/source-catalog/save`, {
      headers,
      data: (await preview.json()).data.draft,
    });
    expect(saved.ok()).toBe(true);
    return (await saved.json()).data.version;
  };
  try {
    sourceId = await createdId(
      (await page.request.post(`${API}/database/upload`, {
        headers,
        multipart: {
          file: { name: 'business-meaning.parquet', mimeType: 'application/octet-stream', buffer: await readFile(file) },
        },
      })) as any,
    );
    metricId = await createdId(
      (await page.request.post(`${API}/bi/metrics`, {
        headers,
        data: {
          sourceId,
          label: 'Business amount',
          aggregation: 'SUM',
          column: 'amount',
          unit: '',
          decimalPlaces: 0,
          numberNotation: 'plain',
        },
      })) as any,
    );
    expect(await catalog('date')).toBe(1);
    await page.goto(`/explore/source?sourceId=${sourceId}`);
    await page.getByRole('button', { name: '조건과 분석 범위', exact: true }).click();
    await page.getByRole('button', { name: '포함 조건 추가', exact: true }).click();
    await page.getByLabel('포함 열', { exact: true }).selectOption('business_day');
    await page.getByLabel('포함 연산자', { exact: true }).selectOption('between');
    await page.getByLabel('포함 값 1', { exact: true }).fill('2024-02-28');
    await page.getByLabel('포함 값 2', { exact: true }).fill('2024-02-29');
    const preview = createResponse(page, 'bi/source-conditions/preview');
    await page.getByRole('button', { name: '건수 미리보기', exact: true }).click();
    const checked = (await (await preview).json()).data;
    expect(checked.population.remaining).toBe('2');
    expect(checked.analysisConditions.semantics.catalogVersion).toBe(1);
    const saved = createResponse(page, 'bi/source-conditions/save');
    await page.getByRole('button', { name: '확인한 조건 저장', exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await page.getByRole('button', { name: '건수 미리보기', exact: true }).click();
    const applied = page.waitForResponse(
      r => r.url().endsWith('/bi/explore/query') && r.request().postDataJSON()?.conditions?.semantics?.catalogVersion === 1,
    );
    await page.getByRole('button', { name: '이 분석에 조건 적용', exact: true }).click();
    expect(Number((await (await applied).json()).data.kpis[0].value)).toBe(300);
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await page.getByLabel('새 보기 이름').fill(name);
    const viewSaved = createResponse(page, 'bi/explore/views/create');
    await page.getByRole('button', { name: '현재 조건 저장', exact: true }).click();
    viewId = await createdId(await viewSaved);
    expect(await catalog('category')).toBe(2);
    await page.reload();
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await page.getByLabel('저장한 탐색 보기').selectOption(String(viewId));
    const restored = page.waitForResponse(
      r => r.url().endsWith('/bi/explore/query') && r.request().postDataJSON()?.conditions?.semantics?.catalogVersion === 1,
    );
    await page.getByRole('button', { name: '보기 열기', exact: true }).click();
    expect(Number((await (await restored).json()).data.kpis[0].value)).toBe(300);
    await page.getByRole('button', { name: '조건과 분석 범위', exact: true }).click();
    await expect(page.getByLabel('포함 연산자', { exact: true })).toHaveValue('between');
    await page.getByRole('button', { name: '최신 업무 의미 채택', exact: true }).click();
    await expect(page.getByLabel('포함 값 1', { exact: true })).toHaveValue('2024-02-28');
    await expect(page.getByLabel('포함 연산자', { exact: true }).locator('option[value="contains"]')).toHaveCount(0);
    await page.getByLabel('포함 연산자', { exact: true }).selectOption('eq');
    await page.getByLabel('포함 값 1', { exact: true }).fill('2024/02/29');
    const newPreview = createResponse(page, 'bi/source-conditions/preview');
    await page.getByRole('button', { name: '건수 미리보기', exact: true }).click();
    expect((await (await newPreview).json()).data.population.remaining).toBe('1');
    const adoptedSaved = createResponse(page, 'bi/source-conditions/save');
    await page.getByRole('button', { name: '확인한 조건 저장', exact: true }).click();
    expect((await adoptedSaved).ok()).toBe(true);
    await page.getByRole('button', { name: '건수 미리보기', exact: true }).click();
    const reapplied = page.waitForResponse(
      r => r.url().endsWith('/bi/explore/query') && r.request().postDataJSON()?.conditions?.semantics?.catalogVersion === 2,
    );
    await page.getByRole('button', { name: '이 분석에 조건 적용', exact: true }).click();
    expect(Number((await (await reapplied).json()).data.kpis[0].value)).toBe(200);
    await page.getByLabel('새 보기 이름').fill(`${name} adopted`);
    const adoptedViewSaved = createResponse(page, 'bi/explore/views/create');
    await page.getByRole('button', { name: '현재 조건 저장', exact: true }).click();
    adoptedViewId = await createdId(await adoptedViewSaved);
    await page.reload();
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await page.getByLabel('저장한 탐색 보기').selectOption(String(adoptedViewId));
    const adoptedRestored = page.waitForResponse(
      r => r.url().endsWith('/bi/explore/query') && r.request().postDataJSON()?.conditions?.semantics?.catalogVersion === 2,
    );
    await page.getByRole('button', { name: '보기 열기', exact: true }).click();
    expect(Number((await (await adoptedRestored).json()).data.kpis[0].value)).toBe(200);
    await page.getByRole('button', { name: '조건과 분석 범위', exact: true }).click();
    await expect(page.getByLabel('포함 값 1', { exact: true })).toHaveValue('2024/02/29');
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const geometry = await page
        .getByRole('button', { name: '최신 업무 의미 채택', exact: true })
        .evaluate(el => ({ height: el.getBoundingClientRect().height, fontSize: getComputedStyle(el).fontSize }));
      expect([32, 36]).toContain(geometry.height);
      expect(geometry.fontSize).toBe('14px');
      await writeFile(info.outputPath(`business-${width}.json`), JSON.stringify({ width, overflow: 0, geometry }, null, 2));
      await page.screenshot({ path: info.outputPath(`business-${width}.png`), fullPage: true });
    }
    // Explicit opt-in only: real installed Codex transport, never the contract fixture provider.
    if (process.env.QA_REAL_CODEX === '1') {
      expect(await catalog('date')).toBe(3);
      const created = await page.request.post(`${API}/bi/dashboards`, {
        headers,
        data: { sourceId, metricId, title: name, chart: 'number' },
      });
      dashboardId = await createdId(created as any);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`/dashboard/${dashboardId}/studio`);
      const openAi = page.getByRole('button', { name: 'AI 열기', exact: true });
      await openAi.click({ timeout: 30000 });
      await page
        .getByLabel('AI에게 요청할 내용', { exact: true })
        .fill('business_day 업무 날짜가 2024년 2월 29일인 행만 포함하는 공통 조건을 제안해 줘.');
      await page.getByRole('button', { name: '전송', exact: true }).click();
      const review = page.getByRole('region', { name: 'AI 조건 변경안 검토', exact: true });
      await expect(review).toBeVisible({ timeout: 180000 });
      await expect(review).toContainText('업무 의미 카탈로그 버전 3');
      await expect(review).toContainText('200');
      await review.getByRole('button', { name: '조건 변경안 적용', exact: true }).click();
      const saved = createResponse(page, `studio/dashboards/${dashboardId}/save`);
      await page.getByRole('button', { name: '저장', exact: true }).click();
      const savedBody = await (await saved).json();
      expect(savedBody.document.conditions.semantics.catalogVersion).toBe(3);
      const loaded = page.waitForResponse(
        r => r.url().endsWith(`/studio/dashboards/${dashboardId}`) && r.request().method() === 'GET',
      );
      await page.reload();
      const stored = await (await loaded).json();
      expect(stored.document.conditions.semantics.catalogVersion).toBe(3);
      expect(Number(stored.preview.widgets[0].datas[0].value)).toBe(200);
      await page.setViewportSize({ width: 390, height: 1000 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: info.outputPath('business-real-codex-390.png'), fullPage: true });
    }
  } finally {
    if (viewId && sourceId)
      await page.request.post(`${API}/bi/explore/views/remove`, { headers, data: { sourceId, viewId } });
    if (adoptedViewId && sourceId)
      await page.request.post(`${API}/bi/explore/views/remove`, { headers, data: { sourceId, viewId: adoptedViewId } });
    await removeOwned(page, headers, 'dashboard', dashboardId);
    await removeOwned(page, headers, 'metric', metricId);
    if (sourceId) {
      const ownSource = await page.request.get(`${API}/database/${sourceId}`, { headers });
      expect(ownSource.ok()).toBe(true);
      for (const dataset of (await ownSource.json()).data.datasets) {
        expect(dataset.databaseId).toBe(sourceId);
        await removeOwned(page, headers, 'dataset', dataset.id);
      }
    }
    await removeOwned(page, headers, 'database', sourceId);
    await rm(root, { recursive: true, force: true });
  }
});
