import { expect, test } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { API, authHeaders, createResponse, createdId, removeOwned } from './core-helpers';

test('조직 공통 분류 → 두 소스 연결 → 이름 보존·명시 채택 → 비활성·해제·새로고침', async ({ page }, info) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  expect(process.env.QA_RUN_ROOT).toBeTruthy();
  const userId = `class${randomBytes(5).toString('hex')}`;
  const password = `Qa1!${randomBytes(6).toString('hex')}`;
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
        data: { name: `Synthetic classification ${randomUUID()}` },
      })
    ).status(),
  ).toBe(201);
  const sources: number[] = [];
  const name = `Revenue ${randomBytes(3).toString('hex')}`;
  const renamed = `${name} revised`;
  const catalog = async (sourceId: number) => {
    const result = await page.request.post(`${API}/bi/source-catalog/read`, { headers, data: { sourceId } });
    expect(result.ok(), await result.text()).toBe(true);
    return (await result.json()).data;
  };
  const openCatalog = async (sourceId: number) => {
    await page.goto(`/explore/source?sourceId=${sourceId}`);
    await page.getByRole('button', { name: '데이터 업무 설명', exact: true }).click();
    const field = page.getByLabel('amount 업무 분류', { exact: true });
    const item = field.locator('xpath=ancestor::li[1]');
    await item.locator('summary').click();
    return item;
  };
  const save = async () => {
    const preview = createResponse(page, 'bi/source-catalog/preview');
    await page.getByRole('button', { name: '변경 내용 미리보기', exact: true }).click();
    expect((await preview).ok()).toBe(true);
    await page.getByRole('checkbox', { name: '표시한 변경 내용을 확인했습니다', exact: true }).check();
    const response = createResponse(page, 'bi/source-catalog/save');
    await page.getByRole('button', { name: '확인한 변경 저장', exact: true }).click();
    const result = await response;
    expect(result.ok(), await result.text()).toBe(true);
    return (await result.json()).data;
  };
  const geometry = async (screen: string) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const target =
        screen === 'source'
          ? page.getByLabel('amount 공통 분류', { exact: true })
          : page.getByLabel('새 공통 분류 이름', { exact: true });
      const box = await target.evaluate(el => ({
        height: el.getBoundingClientRect().height,
        font: getComputedStyle(el).fontSize,
      }));
      expect(box.height).toBe(36);
      let rowAlignment: number[] | null = null;
      if (screen === 'source' && width >= 768) {
        const tops = await Promise.all(
          ['amount 업무 유형', 'amount 날짜 형식', 'amount 업무 분류'].map(label =>
            page.getByLabel(label, { exact: true }).evaluate(el => el.getBoundingClientRect().top),
          ),
        );
        rowAlignment = tops;
        expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
      }
      await expect.poll(() => target.evaluate(el => getComputedStyle(el).fontSize)).toBe(width < 900 ? '16px' : '14px');
      const controls = await page.locator('button, input, select').evaluateAll(elements =>
        elements
          .filter(el => el.getBoundingClientRect().height > 0)
          .map(el => ({
            tag: el.tagName,
            label: el.getAttribute('aria-label') ?? el.textContent?.trim(),
            height: el.getBoundingClientRect().height,
            font: getComputedStyle(el).fontSize,
          })),
      );
      await writeFile(
        info.outputPath(`${screen}-${width}.json`),
        JSON.stringify({ width, overflow: 0, rowAlignment, controls }, null, 2),
      );
      await page.screenshot({ path: info.outputPath(`${screen}-${width}.png`), fullPage: true });
      await target.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`${screen}-${width}-controls.png`), fullPage: false });
      await page.evaluate(() => scrollTo(0, 0));
    }
  };
  try {
    for (let index = 0; index < 2; index++)
      sources.push(
        await createdId(
          await page.request.post(`${API}/database/upload`, {
            headers,
            multipart: {
              file: {
                name: `classification-${index}.csv`,
                mimeType: 'text/csv',
                buffer: Buffer.from('category,amount\nA,100\nB,200\n'),
              },
            },
          }),
        ),
      );
    await page.goto('/organization');
    await page.getByRole('button', { name: '공통 분류', exact: true }).click();
    await page.getByLabel('새 공통 분류 이름', { exact: true }).fill(name);
    const requests: any[] = [];
    let committed: any;
    await page.route(/\/v1\/enterprise\/classifications$/, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      requests.push(route.request().postDataJSON());
      if (requests.length !== 1) return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      committed = await response.json();
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'synthetic response loss after commit' }),
      });
    });
    const creating = createResponse(page, 'enterprise/classifications');
    await page.getByRole('button', { name: '분류 만들기', exact: true }).click();
    expect((await creating).status()).toBe(503);
    await expect(page.getByRole('button', { name: '같은 생성 요청 확인', exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: '공통 분류', exact: true }).click();
    await expect(page.getByRole('button', { name: '같은 생성 요청 확인', exact: true })).toBeVisible();
    expect(requests).toHaveLength(1);
    const confirming = createResponse(page, 'enterprise/classifications');
    await page.getByRole('button', { name: '같은 생성 요청 확인', exact: true }).click();
    const createdResponse = await confirming;
    expect(createdResponse.ok(), await createdResponse.text()).toBe(true);
    const created = await createdResponse.json();
    expect(created.replayed).toBe(true);
    expect(created.entry).toEqual(committed.entry);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    await page.unroute(/\/v1\/enterprise\/classifications$/);
    const listed = await (await page.request.get(`${API}/enterprise/classifications`, { headers })).json();
    expect(listed.entries.filter((entry: any) => entry.name === name)).toHaveLength(1);
    const id = created.entry.id;
    expect(created.entry).toMatchObject({ name, active: true, version: 1 });
    await geometry('registry');
    for (const sourceId of sources) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const item = await openCatalog(sourceId);
      await item.getByRole('button', { name: '공통 분류 불러오기', exact: true }).click();
      const select = page.getByLabel('amount 공통 분류', { exact: true });
      const value = await select.getByRole('option', { name: new RegExp(name) }).getAttribute('value');
      await select.selectOption(value!);
      const saved = await save();
      expect(saved.columns.find((c: any) => c.column === 'amount')).toMatchObject({
        classification: name,
        classificationRef: { organizationId: created.organizationId, id, version: 1 },
      });
      await page.reload();
      expect((await catalog(sourceId)).columns.find((c: any) => c.column === 'amount').classificationRef.id).toBe(id);
    }
    await page.goto('/organization');
    await page.getByRole('button', { name: '공통 분류', exact: true }).click();
    const row = page.getByLabel(`공통 분류 ${id}`, { exact: true });
    await row.getByRole('button', { name: '분류 편집', exact: true }).click();
    await row.getByLabel('분류 이름', { exact: true }).fill(renamed);
    const renaming = createResponse(page, `enterprise/classifications/${id}`);
    await row.getByRole('button', { name: '분류 변경 저장', exact: true }).click();
    expect((await renaming).ok()).toBe(true);
    for (const sourceId of sources)
      expect((await catalog(sourceId)).columns.find((c: any) => c.column === 'amount')).toMatchObject({
        classification: name,
        classificationRef: { id, version: 1 },
      });
    const item = await openCatalog(sources[0]);
    await item.getByRole('button', { name: '공통 분류 불러오기', exact: true }).click();
    const select = page.getByLabel('amount 공통 분류', { exact: true });
    await select.selectOption((await select.getByRole('option', { name: new RegExp(renamed) }).getAttribute('value'))!);
    expect((await save()).columns.find((c: any) => c.column === 'amount')).toMatchObject({
      classification: renamed,
      classificationRef: { id, version: 2 },
    });
    await geometry('source');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/organization');
    await page.getByRole('button', { name: '공통 분류', exact: true }).click();
    await row.getByRole('button', { name: '분류 편집', exact: true }).click();
    await row.getByRole('checkbox', { name: '분류 활성', exact: true }).uncheck();
    const disabling = createResponse(page, `enterprise/classifications/${id}`);
    await row.getByRole('button', { name: '분류 변경 저장', exact: true }).click();
    expect((await disabling).ok()).toBe(true);
    await openCatalog(sources[1]);
    await page.getByLabel('amount 표시명', { exact: true }).fill('Gross amount');
    expect((await save()).columns.find((c: any) => c.column === 'amount')).toMatchObject({
      classification: name,
      classificationRef: { id, version: 1 },
    });
    await page.getByRole('button', { name: '공통 분류 연결 해제', exact: true }).click();
    const detached = await save();
    expect(detached.columns.find((c: any) => c.column === 'amount').classification).toBe(name);
    expect(detached.columns.find((c: any) => c.column === 'amount').classificationRef ?? null).toBeNull();
    await page.reload();
    const final = await catalog(sources[1]);
    expect(final.columns.find((c: any) => c.column === 'amount').classificationRef ?? null).toBeNull();
    await openCatalog(sources[1]);
    await page.getByLabel('amount 업무 분류', { exact: true }).fill('Independent business label');
    const free = await save();
    expect(free.columns.find((c: any) => c.column === 'amount')).toMatchObject({
      classification: 'Independent business label',
      classificationRef: null,
    });
    await page.reload();
    expect((await catalog(sources[1])).columns.find((c: any) => c.column === 'amount').classification).toBe(
      'Independent business label',
    );
    expect((await catalog(sources[0])).columns.find((c: any) => c.column === 'amount')).toMatchObject({
      classification: renamed,
      classificationRef: { id, version: 2 },
    });
  } finally {
    for (const sourceId of sources.reverse()) {
      const source = await page.request.get(`${API}/database/${sourceId}`, { headers });
      if (source.ok())
        for (const dataset of (await source.json()).data.datasets) await removeOwned(page, headers, 'dataset', dataset.id);
      await removeOwned(page, headers, 'database', sourceId);
    }
  }
});

test('페이지 밖의 과거 분류 생성 영수증은 현재 이름·활성 목록을 덮지 않는다', async ({ page }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  expect(process.env.QA_RUN_ROOT).toBeTruthy();
  const userId = `receipt${randomBytes(5).toString('hex')}`;
  const password = `Qa1!${randomBytes(6).toString('hex')}`;
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
        data: { name: `Synthetic receipt ${randomUUID()}` },
      })
    ).status(),
  ).toBe(201);
  const context = await (await page.request.get(`${API}/enterprise/classifications`, { headers })).json();
  for (let index = 0; index < 20; index++)
    expect(
      (
        await page.request.post(`${API}/enterprise/classifications`, {
          headers,
          data: {
            expectedActorId: context.actorId,
            expectedOrganizationId: context.organizationId,
            requestId: randomUUID(),
            name: `Seed ${index}`,
          },
        })
      ).status(),
    ).toBe(201);
  await page.goto('/organization');
  await page.getByRole('button', { name: '공통 분류', exact: true }).click();
  const name = `Historical ${randomBytes(4).toString('hex')}`;
  const currentName = `${name} current`;
  await page.getByLabel('새 공통 분류 이름', { exact: true }).fill(name);
  const requests: any[] = [];
  let receipt: any;
  await page.route(/\/v1\/enterprise\/classifications$/, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    requests.push(route.request().postDataJSON());
    if (requests.length !== 1) return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    receipt = await response.json();
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"message":"synthetic committed response loss"}',
    });
  });
  const creating = createResponse(page, 'enterprise/classifications');
  await page.getByRole('button', { name: '분류 만들기', exact: true }).click();
  expect((await creating).status()).toBe(503);
  await expect(page.getByRole('button', { name: '같은 생성 요청 확인', exact: true })).toBeVisible();
  const id = receipt.entry.id;
  expect(
    (
      await page.request.post(`${API}/enterprise/classifications/${id}`, {
        headers,
        data: {
          expectedActorId: context.actorId,
          expectedOrganizationId: context.organizationId,
          expectedVersion: 1,
          name: currentName,
          active: false,
        },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: '공통 분류', exact: true }).click();
  await expect(page.getByRole('button', { name: '같은 생성 요청 확인', exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  const confirming = createResponse(page, 'enterprise/classifications');
  await page.getByRole('button', { name: '같은 생성 요청 확인', exact: true }).click();
  expect((await (await confirming).json()).entry).toMatchObject({ id, name, version: 1, active: true });
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  await expect(page.getByLabel(`공통 분류 ${id}`, { exact: true })).toHaveCount(0);
  const panel = page.getByRole('region', { name: '조직 공통 분류', exact: true });
  await expect(panel.getByRole('listitem')).toHaveCount(20);
  await panel.getByRole('button', { name: '분류 더 불러오기', exact: true }).click();
  const row = page.getByLabel(`공통 분류 ${id}`, { exact: true });
  await expect(row).toContainText(currentName);
  await expect(row).toContainText('버전 2');
  await expect(row).toContainText('비활성');
  await expect(panel.getByRole('listitem')).toHaveCount(21);
});
