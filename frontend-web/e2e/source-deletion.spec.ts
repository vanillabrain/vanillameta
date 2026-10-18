import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { API, authHeaders, createdId, login, removeOwned } from './core-helpers';

test('Source deletion: 사용처 차단 → 별도 참조 삭제 → metadata 삭제 → reload 후 명시 파일 정리', async ({ page }, info) => {
  // This destructive journey belongs exclusively to qa-runtime's disposable database and upload root.
  expect(process.env.QA_RUN_ROOT, 'Run only through the isolated QA runtime').toBeTruthy();
  expect(process.env.E2E_EXTERNAL_SERVER).toBe('1');
  expect(new URL(API).hostname).toBe('127.0.0.1');
  await login(page);
  const headers = await authHeaders(page);
  let sourceId: number | undefined;
  let independentId: number | undefined;
  let datasetId: number | undefined;
  let receipt: any;
  const label = `source-deletion-${randomUUID()}`;
  const cleanupRequests: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && /\/database\/deletions\/\d+\/cleanup$/.test(new URL(request.url()).pathname))
      cleanupRequests.push(request.url());
  });
  try {
    const upload = async (name: string) => {
      const result = await page.request.post(`${API}/database/upload`, {
        headers,
        multipart: {
          file: { name: `${name}.csv`, mimeType: 'text/csv', buffer: Buffer.from('category,amount\nA,100\nB,200\n') },
        },
      });
      return { id: await createdId(result as any), name: (await result.json()).data.name as string };
    };
    const target = await upload(label);
    sourceId = target.id;
    const independent = await upload(`${label}-independent`);
    independentId = independent.id;
    datasetId = await createdId(
      (await page.request.post(`${API}/dataset`, {
        headers,
        data: { title: `${label} owned reference`, databaseId: sourceId, query: 'SELECT amount FROM uploaded_data' },
      })) as any,
    );
    await page.goto('/data');
    const card = page.locator('li').filter({ has: page.getByText(target.name, { exact: true }) });
    await expect(card).toHaveCount(1);
    const impactRead = page.waitForResponse(r => new URL(r.url()).pathname === `/v1/database/${sourceId}/delete-impact`);
    await card.locator('button').last().click();
    const blocked = await impactRead;
    expect(blocked.status()).toBe(200);
    const blockedData = (await blocked.json()).data;
    expect(blockedData.dependencies).toHaveLength(10);
    expect(blockedData).toMatchObject({
      sourceId,
      canDelete: false,
      dependencies: expect.arrayContaining([{ kind: 'datasets', count: 1 }]),
    });
    const dialog = page.getByRole('dialog', { name: '소스 삭제 영향' });
    await expect(dialog.getByRole('button', { name: '소스 삭제', exact: true })).toBeDisabled();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(dialog).toBeVisible();
      await expect
        .poll(() =>
          dialog.evaluate(element =>
            element
              .getAnimations({ subtree: true })
              .every(animation => animation.playState === 'finished' || animation.playState === 'idle'),
          ),
        )
        .toBe(true);
      const bounds = await dialog.boundingBox();
      if (!bounds) throw new Error('Source deletion dialog is not visible');
      expect(bounds.x).toBeGreaterThanOrEqual(-1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      for (const label of ['사용처 다시 읽기', '소스 삭제', '닫기']) {
        const control = dialog.getByRole('button', { name: label, exact: true });
        await expect(control).toHaveCSS('height', '32px');
        const box = await control.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(31);
        expect(box?.height).toBeLessThanOrEqual(33);
        expect(await control.evaluate(element => getComputedStyle(element).fontSize)).toBe('14px');
      }
      await page.screenshot({ path: info.outputPath(`source-deletion-blocked-${width}.png`), fullPage: true });
    }
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    expect((await page.request.get(`${API}/dataset/${datasetId}`, { headers })).ok()).toBe(true);
    expect((await page.request.get(`${API}/database/${sourceId}`, { headers })).ok()).toBe(true);
    // Only this test's explicitly created reference is removed; deletion never cascades to assets.
    await removeOwned(page, headers, 'dataset', datasetId);
    datasetId = undefined;
    await card.locator('button').last().click();
    await expect(dialog.getByRole('button', { name: '소스 삭제', exact: true })).toBeEnabled();
    const deleted = page.waitForResponse(
      r => new URL(r.url()).pathname === `/v1/database/${sourceId}` && r.request().method() === 'DELETE',
    );
    await dialog.getByRole('button', { name: '소스 삭제', exact: true }).click();
    const result = await deleted;
    expect(result.status()).toBe(200);
    receipt = (await result.json()).data;
    expect(receipt).toMatchObject({ sourceId, deleted: true, replayed: false, cleanup: { status: 'pending' } });
    expect(receipt.cleanup.managedFiles).toBeGreaterThan(0);
    sourceId = undefined;
    await expect(dialog.getByRole('button', { name: '파일 정리', exact: true })).toBeEnabled();
    expect(cleanupRequests).toHaveLength(0);
    const replay = await page.request.delete(`${API}/database/${receipt.sourceId}`, {
      headers,
      data: result.request().postDataJSON(),
    });
    expect((await replay.json()).data).toMatchObject({ receiptId: receipt.receiptId, replayed: true });
    await page.reload();
    await expect(page.getByText(independent.name, { exact: true })).toBeVisible();
    await expect(page.getByText(target.name, { exact: true })).toHaveCount(0);
    expect(cleanupRequests).toHaveLength(0);
    await page.getByRole('button', { name: '소스 삭제·파일 정리 기록', exact: true }).click();
    await dialog.getByRole('button', { name: '파일 정리 기록 읽기', exact: true }).click();
    await dialog.getByRole('button', { name: `영수증 #${receipt.receiptId} 확인`, exact: true }).click();
    await expect(dialog.getByRole('button', { name: '파일 정리', exact: true })).toBeEnabled();
    const cleaned = page.waitForResponse(
      r =>
        new URL(r.url()).pathname === `/v1/database/deletions/${receipt.receiptId}/cleanup` &&
        r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: '파일 정리', exact: true }).click();
    const cleanupResponse = await cleaned;
    expect(cleanupResponse.status()).toBe(201);
    expect(cleanupResponse.request().postDataJSON()).toEqual({ requestId: receipt.requestId });
    receipt = (await cleanupResponse.json()).data;
    expect(receipt.cleanup.status).toBe('complete');
    await expect(dialog.getByText(new RegExp(`관리 파일 ${receipt.cleanup.managedFiles}개 · 파일 정리 완료`))).toBeVisible();
    expect(cleanupRequests).toHaveLength(1);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(dialog).toBeVisible();
      await expect
        .poll(() =>
          dialog.evaluate(element =>
            element
              .getAnimations({ subtree: true })
              .every(animation => animation.playState === 'finished' || animation.playState === 'idle'),
          ),
        )
        .toBe(true);
      const control = dialog.getByRole('button', { name: '파일 정리', exact: true });
      await expect(control).toHaveCSS('height', '32px');
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(31);
      expect(box?.height).toBeLessThanOrEqual(33);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: info.outputPath(`source-deletion-cleanup-${width}.png`), fullPage: true });
    }
    expect((await page.request.get(`${API}/database/${independentId}`, { headers })).ok()).toBe(true);
    const confirmed = await page.request.get(`${API}/database/deletions/${receipt.receiptId}`, { headers });
    expect((await confirmed.json()).data.cleanup.status).toBe('complete');
  } finally {
    await removeOwned(page, headers, 'dataset', datasetId);
    if (receipt && receipt.cleanup.status !== 'complete') {
      const result = await page.request.post(`${API}/database/deletions/${receipt.receiptId}/cleanup`, {
        headers,
        data: { requestId: receipt.requestId },
      });
      expect((await result.json()).data.cleanup.status).toBe('complete');
    }
    await removeOwned(page, headers, 'database', sourceId);
    await removeOwned(page, headers, 'database', independentId);
  }
});
