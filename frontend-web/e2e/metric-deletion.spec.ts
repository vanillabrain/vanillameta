import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { API, authHeaders, createdId, createResponse, login, removeOwned } from './core-helpers';

test('저장 탐색 지표 삭제 차단 → 보기 명시 삭제 → 다시 읽기 → 지표 삭제·영수증·새로고침', async ({ page }, info) => {
  await login(page);
  const headers = await authHeaders(page);
  let sourceId: number | undefined, metricId: number | undefined, viewId: number | undefined;
  const label = `Metric deletion ${randomUUID()}`;
  try {
    sourceId = await createdId(
      (await page.request.post(`${API}/database/upload`, {
        headers,
        multipart: {
          file: {
            name: 'metric-deletion.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from('category,amount,created_at\nA,100,2026-01-03\nA,200,2026-01-04\nB,300,2026-01-03\n'),
          },
        },
      })) as any,
    );
    metricId = await createdId(
      (await page.request.post(`${API}/bi/metrics`, {
        headers,
        data: {
          sourceId,
          label,
          aggregation: 'SUM',
          column: 'amount',
          unit: '',
          decimalPlaces: 0,
          numberNotation: 'plain',
        },
      })) as any,
    );
    await page.goto(`/explore/source?sourceId=${sourceId}`);
    await page.getByRole('button', { name: '탐색 보기', exact: true }).click();
    await page.getByLabel('새 보기 이름').fill(`Saved ${label}`);
    const saved = createResponse(page, 'bi/explore/views/create');
    await page.getByRole('button', { name: '현재 조건 저장', exact: true }).click();
    viewId = await createdId(await saved);
    const list = await page.request.get(`${API}/metric`, { headers });
    const metric = (await list.json()).data.find((row: any) => row.id === metricId);
    expect(metric).toBeTruthy();
    await page.goto('/data/metric');
    const card = page.locator('li').filter({ has: page.getByText(metric.name, { exact: true }) });
    await expect(card).toHaveCount(1);
    const read = page.waitForResponse(r => new URL(r.url()).pathname === `/v1/metric/${metricId}/delete-impact`);
    await card.locator('button').last().click();
    const blocked = await read;
    expect(blocked.status()).toBe(200);
    expect((await blocked.json()).data).toMatchObject({
      canDelete: false,
      dependencies: expect.arrayContaining([{ kind: 'exploreViews', count: 1 }]),
    });
    const dialog = page.getByRole('dialog', { name: '지표 삭제 영향' });
    await expect(dialog.getByRole('button', { name: '지표 삭제', exact: true })).toBeDisabled();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      for (const label of ['사용처 다시 읽기', '지표 삭제', '닫기']) {
        const control = await dialog.getByRole('button', { name: label, exact: true }).boundingBox();
        expect(control?.height).toBeGreaterThanOrEqual(31);
        expect(control?.height).toBeLessThanOrEqual(33);
      }
      await page.screenshot({ path: info.outputPath(`metric-deletion-${width}.png`), fullPage: true });
    }
    const removedView = await page.request.post(`${API}/bi/explore/views/remove`, { headers, data: { sourceId, viewId } });
    expect(removedView.ok()).toBe(true);
    viewId = undefined;
    const reread = page.waitForResponse(r => new URL(r.url()).pathname === `/v1/metric/${metricId}/delete-impact`);
    await dialog.getByRole('button', { name: '사용처 다시 읽기', exact: true }).click();
    expect((await (await reread).json()).data.canDelete).toBe(true);
    const deleted = page.waitForResponse(
      r => new URL(r.url()).pathname === `/v1/metric/${metricId}` && r.request().method() === 'DELETE',
    );
    await dialog.getByRole('button', { name: '지표 삭제', exact: true }).click();
    const response = await deleted;
    expect(response.status()).toBe(200);
    const receipt = (await response.json()).data;
    const id = metricId;
    metricId = undefined;
    const replay = await page.request.delete(`${API}/metric/${id}`, { headers, data: response.request().postDataJSON() });
    expect((await replay.json()).data).toMatchObject({ receiptId: receipt.receiptId, replayed: true });
    await expect(dialog).toHaveCount(0);
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(metric.name, { exact: true })).toHaveCount(0);
    const source = await page.request.get(`${API}/database/${sourceId}`, { headers });
    expect(source.ok()).toBe(true);
  } finally {
    if (viewId && sourceId)
      expect((await page.request.post(`${API}/bi/explore/views/remove`, { headers, data: { sourceId, viewId } })).ok()).toBe(
        true,
      );
    await removeOwned(page, headers, 'metric', metricId);
    await removeOwned(page, headers, 'database', sourceId);
  }
});
