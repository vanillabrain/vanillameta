import { expect, test } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { API, authHeaders, removeOwned } from './core-helpers';

// Discardable accounts, organization and dashboards exist only in qa-runtime's isolated store.
test('Dashboard lifecycle: 영향 확인 → 응답 유실 → reload·동일 요청 확인 → 비활성 차단 → 복원', async ({ page }, info) => {
  test.setTimeout(90000);
  expect(process.env.QA_RUN_ROOT).toBeTruthy();
  expect(process.env.E2E_EXTERNAL_SERVER).toBe('1');
  expect(new URL(API).hostname).toBe('127.0.0.1');
  const userId = `lifecycle${randomBytes(5).toString('hex')}`;
  const password = `Qa1!${randomBytes(6).toString('hex')}`;
  const signup = await page.request.post(`${API}/login/signup`, {
    data: { userId, password, email: `${userId}@example.invalid` },
  });
  expect(signup.status()).toBe(201);
  await page.goto('/login');
  await page.getByLabel('User ID').fill(userId);
  await page.getByLabel(/^Password\s*\*?$/).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const headers = await authHeaders(page);
  const organization = await page.request.post(`${API}/enterprise/organizations`, {
    headers,
    data: { name: `Synthetic lifecycle ${randomUUID()}` },
  });
  expect(organization.status()).toBe(201);
  const title = `Lifecycle ${randomUUID()}`;
  const create = async (title: string) => {
    const response = await page.request.post(`${API}/dashboard`, { headers, data: { title, layout: [] } });
    expect(response.status()).toBe(201);
    return (await response.json()).data.id as number;
  };
  const id = await create(title);
  const independentId = await create(`${title} independent`);
  const path = `/enterprise/resources/dashboard/${id}/lifecycle`;
  let shared = false;
  let frozen: any;
  const mutationRequests: any[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === `/v1${path}`)
      mutationRequests.push(request.postDataJSON());
  });
  const current = async () => {
    const response = await page.request.get(`${API}${path}`, { headers });
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.status).toBe('SUCCESS');
    return payload.data;
  };
  const restoreForCleanup = async () => {
    const state = await current();
    if (!state.active) {
      const response = await page.request.post(`${API}${path}`, {
        headers,
        data: {
          requestId: randomUUID(),
          expectedActorId: state.actorId,
          expectedOrganizationId: state.organizationId,
          expectedVersion: state.version,
          expectedRevision: state.revision,
          active: true,
          acknowledgedImpact: true,
        },
      });
      expect(response.ok()).toBe(true);
    }
  };
  try {
    const share = await page.request.post(`${API}/share-url/share-on/${id}`, {
      headers,
      data: { userId, endDate: '12/31/2030' },
    });
    expect(share.ok()).toBe(true);
    const uuid = (await share.json()).uuid;
    expect(typeof uuid).toBe('string');
    shared = true;
    expect((await page.request.get(`${API}/share-url/share-dashboard/${uuid}`)).ok()).toBe(true);
    // UI-specific steps are filled against the component's actual accessible controls.
    await page.goto('/organization');
    await page.getByRole('button', { name: '자원별 권한 관리 열기', exact: true }).click();
    await page.getByRole('button', { name: `권한 관리: 대시보드 ${title} #${id}`, exact: true }).click();
    const panel = page.getByRole('region', { name: '대시보드 활성 상태', exact: true });
    await panel.getByRole('button', { name: '대시보드 상태 관리 열기', exact: true }).click();
    await panel.getByRole('button', { name: '현재 상태·영향 읽기', exact: true }).click();
    const initial = await current();
    expect(initial.dependencies).toContainEqual({ kind: 'liveShare', count: 1 });
    expect(initial.active).toBe(true);
    // This test deliberately loses only the response after the real server commits.
    await page.route(`**/v1${path}`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      frozen = route.request().postDataJSON();
      const committed = await route.fetch();
      expect(committed.ok()).toBe(true);
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic response loss' }),
      });
    });
    const lostResponse = page.waitForResponse(
      response =>
        new URL(response.url()).pathname === `/v1${path}` &&
        response.request().method() === 'POST' &&
        response.status() === 503,
    );
    await panel.getByLabel('저장할 대시보드 상태').selectOption('inactive');
    await panel.getByRole('checkbox', { name: /영향/ }).check();
    await panel.getByRole('button', { name: '대시보드 상태 저장', exact: true }).click();
    await lostResponse;
    await page.unroute(`**/v1${path}`);
    await expect.poll(() => mutationRequests.length).toBe(1);
    await expect(panel.getByRole('button', { name: '같은 요청으로 상태 변경 결과 확인', exact: true })).toBeVisible();
    expect((await current()).active).toBe(false);
    expect((await page.request.get(`${API}/dashboard/${id}`, { headers })).ok()).toBe(false);
    expect((await page.request.get(`${API}/share-url/share-dashboard/${uuid}`)).ok()).toBe(false);
    expect((await page.request.get(`${API}/dashboard/${independentId}`, { headers })).ok()).toBe(true);
    // Retry contention is injected before upstream delivery; it must not erase the original request.
    await page.route(`**/v1${path}`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      expect(route.request().postDataJSON()).toEqual(frozen);
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          code: 409,
          data: {
            code: 'DASHBOARD_LIFECYCLE_RETRY_REQUIRED',
            message: 'Synthetic retry contention',
          },
        }),
      });
    });
    const contention = page.waitForResponse(
      response =>
        new URL(response.url()).pathname === `/v1${path}` &&
        response.request().method() === 'POST' &&
        response.status() === 409,
    );
    await panel.getByRole('button', { name: '같은 요청으로 상태 변경 결과 확인', exact: true }).click();
    await contention;
    await page.unroute(`**/v1${path}`);
    await expect(panel.getByRole('button', { name: '같은 요청으로 상태 변경 결과 확인', exact: true })).toBeEnabled();
    await expect(panel.getByRole('button', { name: '대시보드 상태 저장', exact: true })).toBeDisabled();
    expect(mutationRequests).toHaveLength(2);
    expect(mutationRequests[1]).toEqual(frozen);
    const writes = mutationRequests.length;
    await page.reload();
    expect(mutationRequests).toHaveLength(writes);
    // No request is re-executed merely by reload. The pending request needs explicit confirmation.
    await page.getByRole('button', { name: '자원별 권한 관리 열기', exact: true }).click();
    await page.getByRole('button', { name: `권한 관리: 대시보드 ${title} #${id}`, exact: true }).click();
    await panel.getByRole('button', { name: '대시보드 상태 관리 열기', exact: true }).click();
    await panel.getByRole('button', { name: '현재 상태·영향 읽기', exact: true }).click();
    await expect(panel.getByRole('button', { name: '같은 요청으로 상태 변경 결과 확인', exact: true })).toBeEnabled();
    await panel.getByRole('button', { name: '같은 요청으로 상태 변경 결과 확인', exact: true }).click();
    await expect.poll(() => mutationRequests.length).toBe(writes + 1);
    expect(mutationRequests[mutationRequests.length - 1]).toEqual(frozen);
    expect((await current()).version).toBe(initial.version + 1);
    // Restoration uses a new impact read and new explicit consent, never a historical receipt.
    await panel.getByRole('button', { name: '현재 상태·영향 읽기', exact: true }).click();
    await panel.getByLabel('저장할 대시보드 상태').selectOption('active');
    await panel.getByRole('checkbox', { name: /영향/ }).check();
    await panel.getByRole('button', { name: '대시보드 상태 저장', exact: true }).click();
    await expect.poll(async () => (await current()).active).toBe(true);
    expect((await page.request.get(`${API}/share-url/share-dashboard/${uuid}`)).ok()).toBe(true);
    const replay = await page.request.post(`${API}${path}`, { headers, data: frozen });
    expect((await replay.json()).data.replayed).toBe(true);
    expect((await current()).active).toBe(true);
    await panel.getByRole('button', { name: '현재 상태·영향 읽기', exact: true }).click();
    await expect(panel.getByRole('region', { name: '현재 대시보드 상태', exact: true })).toBeVisible();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await panel.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const organizationLabel = page.locator('dt').filter({ hasText: /^조직$/ });
      const labelText = await organizationLabel.evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return { lines: range.getClientRects().length, height: range.getBoundingClientRect().height };
      });
      expect(labelText.lines).toBe(1);
      expect(labelText.height).toBeLessThanOrEqual(21);
      const box = await panel.boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      for (const [label, height] of [
        ['현재 상태·영향 읽기', 32],
        ['대시보드 상태 저장', 36],
      ] as const) {
        const control = panel.getByRole('button', { name: label, exact: true });
        await expect(control).toHaveCSS('height', `${height}px`);
        await expect(control).toHaveCSS('font-size', '14px');
        const bounds = await control.boundingBox();
        expect(bounds!.height).toBeGreaterThanOrEqual(height - 1);
        expect(bounds!.height).toBeLessThanOrEqual(height + 1);
      }
      await page.screenshot({ path: info.outputPath(`dashboard-lifecycle-${width}.png`), fullPage: true });
    }
  } finally {
    await page.unroute(`**/v1${path}`);
    await restoreForCleanup();
    if (shared) expect((await page.request.post(`${API}/share-url/share-off/${id}`, { headers })).ok()).toBe(true);
    await removeOwned(page, headers, 'dashboard', id);
    await removeOwned(page, headers, 'dashboard', independentId);
  }
});
