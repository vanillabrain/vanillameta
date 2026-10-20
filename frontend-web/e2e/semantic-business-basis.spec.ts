import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { API, authHeaders, createResponse, createdId } from './core-helpers';

// qa-runtime destroys its owned store; these synthetic records never touch the running user store.
test('업무 기준 생성: 숫자 범주·문자 날짜 → 직접 미리보기 → 실제 AI·저장·reload', async ({ page }, info) => {
  test.setTimeout(process.env.QA_REAL_CODEX === '1' ? 360000 : 120000);
  expect(process.env.QA_RUN_ROOT).toBeTruthy();
  const root = await mkdtemp(path.join(os.tmpdir(), 'vm-semantic-ui-'));
  const file = path.join(root, 'business.parquet');
  const backendRequire = createRequire(path.resolve(process.cwd(), '../backend-api/package.json'));
  const { DuckDBInstance } = backendRequire('@duckdb/node-api');
  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();
  try {
    await conn.run(
      "CREATE TABLE typed(category_code INTEGER, amount DECIMAL(18,2), business_day VARCHAR); INSERT INTO typed VALUES (101,10,'2024/02/29'),(102,20,'2024/02/29'),(101,30,'2024/03/01')",
    );
    await conn.run(`COPY typed TO '${file.replace(/'/g, "''")}' (FORMAT PARQUET)`);
  } finally {
    conn.closeSync();
    instance.closeSync();
  }
  try {
    const userId = `sem${randomBytes(5).toString('hex')}`,
      password = `Qa1!${randomBytes(6).toString('hex')}`;
    expect(
      (
        await page.request.post(`${API}/login/signup`, { data: { userId, password, email: `${userId}@example.invalid` } })
      ).status(),
    ).toBe(201);
    await page.goto('/login');
    await page.getByLabel('User ID').fill(userId);
    await page.getByLabel(/^Password\s*\*?$/).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const headers = await authHeaders(page);
    expect(
      (
        await page.request.post(`${API}/enterprise/organizations`, {
          headers,
          data: { name: `Synthetic semantic ${randomUUID()}` },
        })
      ).status(),
    ).toBe(201);
    const sourceId = await createdId(
      (await page.request.post(`${API}/database/upload`, {
        headers,
        multipart: {
          file: { name: 'semantic-business.parquet', mimeType: 'application/octet-stream', buffer: await readFile(file) },
        },
      })) as any,
    );
    const original = (
      await (await page.request.post(`${API}/bi/source-catalog/read`, { headers, data: { sourceId } })).json()
    ).data;
    const draft = {
      ...original,
      sourceId,
      columns: original.columns.map((column: any) => {
        const c = { ...column };
        delete c.type;
        return {
          ...c,
          label: c.column === 'amount' ? '매출액' : c.column === 'category_code' ? '분류 코드' : '거래일',
          businessType: c.column === 'amount' ? 'number' : c.column === 'category_code' ? 'category' : 'date',
          dateFormat: c.column === 'business_day' ? 'YYYY/MM/DD' : '',
          unit: c.column === 'amount' ? 'USD' : '',
        };
      }),
    };
    // Read responses include read-only fields; preview accepts the explicit editable projection.
    const body = {
      sourceId,
      sourceRevision: draft.sourceRevision,
      version: draft.version,
      label: draft.label,
      description: draft.description,
      columns: draft.columns,
    };
    const prepared = await page.request.post(`${API}/bi/source-catalog/preview`, { headers, data: body });
    expect(prepared.ok(), await prepared.text()).toBe(true);
    const saved = await page.request.post(`${API}/bi/source-catalog/save`, {
      headers,
      data: (await prepared.json()).data.draft,
    });
    expect(saved.ok(), await saved.text()).toBe(true);
    await page.goto(`/explore/source?sourceId=${sourceId}`);
    await page.getByRole('button', { name: '지표 빌더', exact: true }).click();
    const operand = page.getByLabel('집계할 열', { exact: true });
    await expect(operand).toBeVisible();
    await expect(operand.locator('option[value="category_code"]')).toHaveCount(0);
    await expect(operand.locator('option[value="business_day"]')).toHaveCount(0);
    await operand.selectOption('amount');
    await expect(page.getByLabel('단위 (선택)', { exact: true })).toHaveValue('USD');
    await page.getByLabel('지표 이름', { exact: true }).fill('Synthetic revenue');
    const storing = createResponse(page, 'bi/metrics');
    await page.getByRole('button', { name: '지표 저장', exact: true }).click();
    expect((await storing).ok()).toBe(true);
    await page.getByLabel('차트 제목', { exact: true }).fill('Synthetic sales');
    for (const [chart, dimension, values] of [
      ['bar', 'category_code', [20, 40]],
      ['line', 'business_day', [30, 30]],
    ] as const) {
      await page.getByLabel('차트 종류', { exact: true }).selectOption(chart);
      await page.getByLabel(chart === 'line' ? '날짜 열' : '범주 열', { exact: true }).selectOption(dimension);
      const response = createResponse(page, 'bi/preview');
      await page.getByRole('button', { name: '결과 미리보기', exact: true }).click();
      const result = await response;
      expect(result.ok(), await result.text()).toBe(true);
      const preview = (await result.json()).data;
      expect(preview.rows.map((r: any) => Number(r.value)).sort((a: number, b: number) => a - b)).toEqual(values);
    }
    const geometry = async (screen: string, labels: string[]) => {
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
          .toBeLessThanOrEqual(0);
        const controls = [];
        for (const label of labels) {
          const target = page.getByLabel(label, { exact: true });
          const result = await target.evaluate(el => ({
            label: el.getAttribute('aria-label') ?? el.id,
            height: el.getBoundingClientRect().height,
            font: getComputedStyle(el).fontSize,
          }));
          expect(result.height).toBe(36);
          await expect.poll(() => target.evaluate(el => getComputedStyle(el).fontSize)).toBe(width < 900 ? '16px' : '14px');
          controls.push(result);
        }
        await expect
          .poll(() =>
            page
              .locator('[_echarts_instance_]')
              .evaluateAll(nodes =>
                nodes.every(
                  el =>
                    Array.from(el.querySelectorAll('canvas,svg')).length > 0 &&
                    Array.from(el.querySelectorAll('canvas,svg')).every(
                      canvas => canvas.getBoundingClientRect().width <= el.getBoundingClientRect().width + 1,
                    ),
                ),
              ),
          )
          .toBe(true);
        const charts = await page.locator('.echarts-for-react').evaluateAll(nodes =>
          nodes.map(el => ({
            width: el.getBoundingClientRect().width,
            ancestors: [el.parentElement, el.parentElement?.parentElement].map(
              p => p && { class: p.className, width: p.getBoundingClientRect().width },
            ),
            canvas: Array.from(el.querySelectorAll('canvas,svg')).map(c => ({
              width: c.getBoundingClientRect().width,
              style: c.getAttribute('style'),
            })),
          })),
        );
        await writeFile(info.outputPath(`${screen}-${width}-charts.json`), JSON.stringify(charts, null, 2));
        await writeFile(
          info.outputPath(`${screen}-${width}.json`),
          JSON.stringify({ width, overflow: 0, controls }, null, 2),
        );
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`${screen}-${width}.png`), fullPage: true });
      }
    };
    await geometry('direct', ['집계 방법', '집계할 열', '차트 종류', '날짜 열']);
    if (process.env.QA_REAL_CODEX !== '1') return;
    await page.goto('/studio/new');
    await page.getByLabel('저장된 데이터', { exact: true }).selectOption(String(sourceId));
    const prompt =
      'amount 매출액 합계 숫자 1개와 business_day 거래일 날짜별 매출액 합계 선 차트 1개, category_code 분류 코드별 매출액 합계 막대 차트 1개를 만들어 줘. 저장된 매출 지표가 있으면 재사용해. business_day는 YYYY/MM/DD 문자열 날짜이고 category_code는 숫자가 아닌 범주야. 아직 저장하거나 게시하지 마.';
    await page.getByLabel('만들 대시보드 요청', { exact: true }).fill(prompt);
    const proposing = page.waitForResponse(r => r.url().endsWith('/studio/proposals') && r.request().method() === 'POST', {
      timeout: 200000,
    });
    await page.getByRole('button', { name: '지표와 차트 제안', exact: true }).click();
    const proposalResponse = await proposing;
    expect(proposalResponse.ok(), await proposalResponse.text()).toBe(true);
    const proposal = await proposalResponse.json();
    await writeFile(info.outputPath('real-proposal.json'), JSON.stringify(proposal, null, 2));
    expect(proposal.preview.widgets).toHaveLength(3);
    const numeric = proposal.preview.widgets.find((w: any) => w.type === 'BOARD_NUMERIC');
    expect(Number(numeric.datas[0][numeric.valueField])).toBe(60);
    expect(numeric.trend.points.map((p: any) => Number(p.value)).sort((a: number, b: number) => a - b)).toEqual([30, 30]);
    const line = proposal.preview.widgets.find((w: any) => w.type === 'CHART_LINE');
    expect(line.datas.map((r: any) => Number(r[line.valueField])).sort((a: number, b: number) => a - b)).toEqual([30, 30]);
    await geometry('creation', ['저장된 데이터']);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const saving = createResponse(page, 'studio/dashboards');
    await page.getByRole('button', { name: 'Studio에 저장하고 열기', exact: true }).click();
    const created = await saving;
    expect(created.ok(), await created.text()).toBe(true);
    await expect(page).toHaveURL(/\/dashboard\/\d+\/studio$/);
    const dashboardMatch = page.url().match(/dashboard\/(\d+)/);
    if (!dashboardMatch) throw new Error('Missing dashboard route');
    const dashboardId = Number(dashboardMatch[1]);
    await page.reload();
    const loaded = await page.request.get(`${API}/studio/dashboards/${dashboardId}`, { headers });
    expect(loaded.ok(), await loaded.text()).toBe(true);
    const data = await loaded.json();
    await writeFile(info.outputPath('saved-reload.json'), JSON.stringify(data, null, 2));
    expect(data.preview.widgets).toHaveLength(3);
    const board = data.preview.widgets.find((w: any) => w.type === 'BOARD_NUMERIC');
    expect(Number(board.datas[0][board.valueField])).toBe(60);
    expect(board.trend.points.map((p: any) => Number(p.value)).sort((a: number, b: number) => a - b)).toEqual([30, 30]);
    await expect(page.getByRole('button', { name: '게시·공유', exact: true })).toBeVisible();
    await geometry('saved', []);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: '게시·공유', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '게시·공유', exact: true });
    await dialog.getByRole('checkbox', { name: '내 데이터로 복제 허용', exact: true }).check();
    const publishing = createResponse(page, `studio/dashboards/${dashboardId}/publications`);
    await dialog.getByRole('button', { name: '게시하기', exact: true }).click();
    const published = await publishing;
    expect(published.ok(), await published.text()).toBe(true);
    const publication = await published.json();
    expect(publication.visibility).toBe('private');
    const snapshotResponse = await page.request.get(`${API}/studio/publications/${publication.token}`, { headers });
    expect(snapshotResponse.ok(), await snapshotResponse.text()).toBe(true);
    const snapshot = await snapshotResponse.json();
    expect(JSON.stringify(snapshot)).not.toMatch(/businessBasis|nativeType|classificationRef|try_strptime/);
    expect(snapshot.snapshot.blocks).toHaveLength(3);
    const publicBoard = snapshot.snapshot.blocks.find((b: any) => b.kind === 'BOARD_NUMERIC');
    expect(Number(publicBoard.datas[0][publicBoard.valueField])).toBe(60);
    expect(publicBoard.trend.points.map((p: any) => Number(p.value)).sort((a: number, b: number) => a - b)).toEqual([
      30, 30,
    ]);
    const templateResponse = await page.request.get(`${API}/studio/publications/${publication.token}/remix-template`, {
      headers,
    });
    expect(templateResponse.ok(), await templateResponse.text()).toBe(true);
    const template = await templateResponse.json();
    expect(template.blocks.every((b: any) => b.supported)).toBe(true);
    await writeFile(
      info.outputPath('publication-template.json'),
      JSON.stringify({ publication, snapshot, template }, null, 2),
    );
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const expiry = dialog.getByLabel('링크 만료 시각 (내 시간대)', { exact: true });
      await expect.poll(() => expiry.evaluate(el => el.getBoundingClientRect().height)).toBe(36);
      await expect.poll(() => expiry.evaluate(el => getComputedStyle(el).fontSize)).toBe(width < 900 ? '16px' : '14px');
      await page.screenshot({ path: info.outputPath(`publication-${width}.png`), fullPage: true });
    }
    expect((await page.request.post(`${API}/studio/publications/${publication.token}/revoke`, { headers })).ok()).toBe(true);
    expect((await page.request.get(`${API}/studio/publications/${publication.token}`, { headers })).status()).toBe(410);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
