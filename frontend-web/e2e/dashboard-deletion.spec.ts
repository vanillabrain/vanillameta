import { expect, test } from '@playwright/test';
import { API, USER, authHeaders, login, removeOwned } from './core-helpers';

test('삭제 영향 차단 → 직접 공유 중지 → 다시 읽기 → 명시 삭제 → 영수증 확인·새로고침', async ({ page }, testInfo) => {
  await login(page);
  const headers = await authHeaders(page);
  const title = `Deletion boundary ${Date.now()}`;
  let dashboardId: number | undefined;
  let otherId: number | undefined;
  try {
    const createFixture = async (label: string) => {
      const response = await page.request.post(`${API}/dashboard`, { headers, data: { title: label, layout: [] } });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.status).toBe('SUCCESS');
      expect(Number.isSafeInteger(body.data.id) && body.data.id > 0).toBe(true);
      return body.data.id as number;
    };
    dashboardId = await createFixture(title);
    otherId = await createFixture(`${title} independent`);
    const shared = await page.request.post(`${API}/share-url/share-on/${dashboardId}`, {
      headers,
      data: { userId: USER.userId, endDate: '12/31/2030' },
    });
    expect(shared.ok()).toBe(true);
    await page.goto('/dashboard');
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    const impactRead = page.waitForResponse(
      response =>
        new URL(response.url()).pathname === `/v1/dashboard/${dashboardId}/delete-impact` &&
        response.request().method() === 'GET',
    );
    await page.getByRole('button', { name: `${title} · 삭제`, exact: true }).click();
    const blocked = await impactRead;
    expect(blocked.status()).toBe(200);
    expect((await blocked.json()).data).toMatchObject({
      canDelete: false,
      dependencies: expect.arrayContaining([{ kind: 'liveShare', count: 1 }]),
    });
    const dialog = page.getByRole('dialog', { name: '대시보드 삭제 영향' });
    await expect(dialog.getByRole('button', { name: '대시보드 삭제', exact: true })).toBeDisabled();
    await expect(dialog.getByText(/사용처 설정이 남아 있어 삭제할 수 없습니다/)).toBeVisible();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(dialog).toBeVisible();
      const bounds = await dialog.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(-1);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      for (const label of ['사용처 다시 읽기', '대시보드 삭제', '닫기']) {
        const box = await dialog.getByRole('button', { name: label, exact: true }).boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(31);
        expect(box?.height).toBeLessThanOrEqual(33);
      }
      await page.screenshot({ path: testInfo.outputPath(`deletion-blocked-${width}.png`), fullPage: true });
    }
    // Stopping is a separate explicit test action; deletion never cascades to the share.
    const stopped = await page.request.post(`${API}/share-url/share-off/${dashboardId}`, { headers });
    expect(stopped.ok()).toBe(true);
    const reread = page.waitForResponse(
      response =>
        new URL(response.url()).pathname === `/v1/dashboard/${dashboardId}/delete-impact` &&
        response.request().method() === 'GET',
    );
    await dialog.getByRole('button', { name: '사용처 다시 읽기', exact: true }).click();
    expect((await (await reread).json()).data.canDelete).toBe(true);
    const confirm = dialog.getByRole('button', { name: '대시보드 삭제', exact: true });
    await expect(confirm).toBeEnabled();
    const response = page.waitForResponse(
      result => new URL(result.url()).pathname === `/v1/dashboard/${dashboardId}` && result.request().method() === 'DELETE',
    );
    await confirm.click();
    const deleted = await response;
    expect(deleted.status()).toBe(200);
    const result = await deleted.json();
    expect(result.status).toBe('SUCCESS');
    expect(result.data.deleted).toBe(true);
    const deletedId = dashboardId;
    dashboardId = undefined; // Only the confirmed operation is exempt from fixture cleanup.
    const replay = await page.request.delete(`${API}/dashboard/${deletedId}`, {
      headers,
      data: deleted.request().postDataJSON(),
    });
    expect(replay.ok()).toBe(true);
    expect((await replay.json()).data).toMatchObject({ receiptId: result.data.receiptId, replayed: true });
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(`${title} independent`, { exact: true })).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    const preserved = await page.request.get(`${API}/dashboard/${otherId}`, { headers });
    expect(preserved.ok()).toBe(true);
    expect((await preserved.json()).data.title).toBe(`${title} independent`);
  } finally {
    if (dashboardId) {
      const stopped = await page.request.post(`${API}/share-url/share-off/${dashboardId}`, { headers });
      expect(stopped.ok()).toBe(true);
      await removeOwned(page, headers, 'dashboard', dashboardId);
    }
    await removeOwned(page, headers, 'dashboard', otherId);
  }
});
