import { expect, test, Page } from '@playwright/test';

/**
 * 제품 전체 플로우 E2E — 실서버 연동
 * 전제: backend :4000, frontend :3000, e2etester 계정 존재
 * serial: 위젯 → 대시보드 → 공유 순서 의존성 있음
 */

const USER = { userId: 'e2etester', password: 'Test1234!' };
const API = 'http://localhost:4000/v1';
let widgetTitle = '';
let dashboardId = '';
let shareUuid = '';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[name="userId"]').fill(USER.userId);
  await page.locator('input[name="userPwd"]').fill(USER.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
}

async function getToken(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('accessToken') || 'null'));
}

async function api(page: Page, method: string, path: string, data?: any) {
  const token = await getToken(page);
  return page.request[method](API + path, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

async function confirmDialog(page: Page, label: RegExp) {
  // react-alert 확인 팝업의 액션 버튼 — react-alert 컨테이너 안에서 첫 번째 매칭(액션 버튼이 Cancel보다 먼저 렌더됨)
  const words = label.source.split('|');
  const sel = words.map(w => `[role="dialog"] button:has-text("${w}")`).join(', ');
  await page.locator(sel).first().click({ timeout: 10000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('제품 전체 플로우', () => {
  test('회원가입 — 검증 에러와 성공', async ({ page }) => {
    await page.goto('/signup');
    // 비밀번호 규칙 위반 → 에러 스낵바
    const uid = `e2e${Date.now()}`.slice(0, 18);
    await page.locator('input[name="userId"]').fill(uid);
    await page.locator('input[name="userPwd"]').fill('weak');
    await page.locator('input[name="userConfirmPwd"]').fill('weak');
    await page.locator('input[name="userEmail"]').fill('e2e@test.com');
    await page.locator('button[type="submit"]').click();
    // 검증 에러가 표시되고 페이지에 머뭄
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/signup');

    // 정상 입력 → 가입 성공
    await page.locator('input[name="userPwd"]').fill('Test1234!');
    await page.locator('input[name="userConfirmPwd"]').fill('Test1234!');
    await page.locator('button[type="submit"]').click();
    // 성공 시 확인 팝업 또는 로그인 이동
    await page.waitForTimeout(2000);
    const moved = page.url().includes('/login') || page.url().includes('/dashboard');
    if (!moved) {
      // 확인 팝업이 떴으면 클릭
      const confirm = page.locator('button:has-text("확인"), button:has-text("OK"), button:has-text("Confirm")').first();
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
    }
  });

  test('로그인 실패 — 잘못된 비밀번호', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="userId"]').fill(USER.userId);
    await page.locator('input[name="userPwd"]').fill('WrongPass1!');
    await page.locator('button[type="submit"]').click();
    // 401 → 에러 표시, 페이지 유지
    await page.waitForTimeout(2500);
    expect(page.url()).toContain('/login');
  });

  test('로그인 성공 → 대시보드', async ({ page }) => {
    await login(page);
    await expect(page.locator('header, nav').first()).toBeVisible({ timeout: 10000 });
  });

  test('데이터 페이지 — 업로드된 소스/데이터셋 보임', async ({ page }) => {
    await login(page);
    await page.goto('/data');
    // 이전 테스트에서 만든 sales 소스가 보여야 함
    await expect(page.locator('body')).toContainText(/sales/i, { timeout: 10000 });
  });

  test('메트릭 생성 → 평가 → 삭제', async ({ page }) => {
    await login(page);
    // 이전 실행 잔여분 정리 (API)
    const list = await api(page, 'get', '/metric');
    const metrics = (await list.json().catch(() => ({}))).data || [];
    for (const m of metrics.filter((x: any) => String(x.name).startsWith('e2e_'))) {
      await api(page, 'delete', `/metric/${m.id}`);
    }

    await page.goto('/data/metric');
    await page.locator('button:has-text("메트릭 추가"), button:has-text("Add metric")').first().click();
    await page.waitForSelector('.MuiDialog-root', { timeout: 5000 });

    const dialog = page.locator('.MuiDialog-root');
    await dialog
      .getByLabel(/Name|이름/i)
      .first()
      .fill('e2e_total_amount');
    await dialog.locator('.MuiSelect-select').first().click();
    await page.locator('li[role="option"]').first().click();
    await dialog.getByLabel(/Table name|테이블/i).fill('uploaded_data');
    await dialog.locator('.MuiSelect-select').nth(1).click();
    await page.locator('li[role="option"]:has-text("SUM")').click();
    await dialog.getByLabel(/Expression|표현식|컬럼/i).fill('amount');
    await dialog.locator('button:has-text("생성"), button:has-text("Create")').click();
    // 다이얼로그가 닫히고 카드가 나타날 때까지
    await expect(page.locator('.MuiDialog-root')).toHaveCount(0, { timeout: 10000 });
    const card = page.locator('.MuiCard-root', { hasText: 'e2e_total_amount' }).first();
    await expect(card).toBeVisible({ timeout: 5000 });

    // 평가 — 카드 내 Evaluate 버튼
    await card.locator('button:has-text("평가"), button:has-text("Evaluate")').click();
    await page.waitForTimeout(3000);

    // 삭제 — 카드의 마지막 IconButton
    await card.locator('button').last().click();
    await expect(page.locator('.MuiCard-root', { hasText: 'e2e_total_amount' })).toHaveCount(0, { timeout: 5000 });
  });

  test('위젯 생성 — 데이터 선택 → 타입 → 속성 → 저장', async ({ page }) => {
    await login(page);
    await page.goto('/widget/create');

    // Step 1: 데이터 소스 카드 클릭 → 테이블 카드 클릭
    await page.locator('li, [class*="CardWrapper"], .MuiListItem-root', { hasText: /sales/i }).first().click();
    await page.waitForTimeout(1000);
    await page
      .locator('li, [class*="CardWrapper"], .MuiListItem-root', { hasText: /uploaded_data/i })
      .first()
      .click();
    await page.waitForTimeout(500);

    // Next 활성화 확인 후 클릭
    const nextBtn = page.locator('button:has-text("다음"), button:has-text("Next")').first();
    await expect(nextBtn).toBeEnabled({ timeout: 5000 });
    await nextBtn.click();

    // Step 2: 차트 타입 카드 선택 (첫 번째)
    await page.waitForTimeout(2000);
    await page.locator('main ul li:has(img), ul li:has(img)').first().click();
    await nextBtn.click();
    await page.waitForTimeout(1500);

    // Step 3: 필수 Field 선택 → 위젯 제목 입력 → 저장 → 확인 팝업 → POST 확인
    widgetTitle = `E2E 위젯 ${Date.now() % 10000}`;
    // 필수 Field(*) select 열고 첫 번째 실제 값 선택 (첫 항목은 '선택 없음' placeholder)
    const fieldForm = page.locator('.MuiFormControl-root', { hasText: /Field/ }).last();
    await fieldForm.locator('.MuiSelect-select, [role="combobox"]').first().click();
    await page.waitForTimeout(400);
    await page
      .locator('li[role="option"]')
      .filter({ hasNotText: /선택 없음|None/ })
      .first()
      .click();
    // 위젯 제목 입력 (WidgetTitleForm: id=title)
    await page.locator('#title').fill(widgetTitle);
    const createResp = page.waitForResponse(r => r.url().includes('/v1/widget') && r.request().method() === 'POST', {
      timeout: 15000,
    });
    await page.locator('button:has-text("저장"), button:has-text("Save")').last().click();
    await page.waitForTimeout(500);
    await confirmDialog(page, /저장|Save/);
    const resp = await createResp;
    expect(resp.status(), await resp.text()).toBe(201);
    await page.waitForURL(/\/widget$/, { timeout: 15000 });
  });

  test('위젯 목록에 생성된 위젯 표시', async ({ page }) => {
    await login(page);
    await page.goto('/widget');
    await expect(page.locator('body')).toContainText(widgetTitle, { timeout: 10000 });
  });

  test('대시보드 생성 — 위젯 배치 → 저장', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/create');
    await page.waitForTimeout(1500);

    // 대시보드 이름 (id=userDashboardName)
    await page.locator('#userDashboardName').fill('E2E 대시보드');

    // 위젯 추가 버튼 → 팝업에서 위젯 선택 → 확인
    await page.locator('button:has-text("위젯 추가"), button:has-text("Add widget")').first().click();
    await page.waitForTimeout(1500);
    const item = page
      .locator('.MuiDialog-root .MuiListItemButton-root, .MuiDialog-root li, .MuiDialog-root [role="button"]', {
        hasText: /E2E 위젯|숫자판/,
      })
      .first();
    await item.click();
    await page.waitForTimeout(500);
    // 팝업 하단 '위젯 추가' 버튼
    await page.locator('.MuiDialog-root button:has-text("추가"), .MuiDialog-root button:has-text("Add")').last().click();
    await page.waitForTimeout(1500);

    // 저장 → 확인 팝업 → 생성 (POST /v1/dashboard 확인)
    const createResp = page.waitForResponse(r => r.url().match(/\/v1\/dashboard/) && r.request().method() === 'POST', {
      timeout: 15000,
    });
    await page.locator('button:has-text("저장"), button:has-text("Save")').first().click();
    await page.waitForTimeout(500);
    await confirmDialog(page, /생성|Create/);
    const resp = await createResp;
    expect(resp.status(), await resp.text()).toBe(201);
    await page.waitForURL(/\/dashboard$/, { timeout: 15000 });
  });

  test('대시보드 목록 → 뷰 진입 → 공유 on', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.locator('text=E2E 대시보드').first().click();
    await page.waitForURL(/\/dashboard\/\d+/, { timeout: 10000 });
    dashboardId = page.url().split('/dashboard/')[1];

    // API로 공유 on (날짜 picker UI 대신)
    const res = await api(page, 'post', `/share-url/share-on/${dashboardId}`, {
      userId: USER.userId,
      endDate: '12/31/2030',
    });
    const body = await res.json().catch(() => ({}));
    shareUuid = body.uuid || '';
    console.log('share-on status:', res.status(), 'uuid:', shareUuid);
    expect([200, 201]).toContain(res.status());
  });

  test('공개 공유 페이지 (/share/:uuid) — 무인증 접근', async ({ browser }) => {
    test.skip(!shareUuid, 'shareUuid 없음');
    const ctx = await browser.newContext(); // 인증 없는 새 세션
    const page = await ctx.newPage();
    await page.goto(`/share/${shareUuid}`);
    // 대시보드 그리드 렌더링
    await expect(page.locator('body')).toContainText('E2E 대시보드', { timeout: 15000 });
    await ctx.close();
  });

  test('임베드 페이지 (/embed/:uuid)', async ({ page }) => {
    test.skip(!shareUuid, 'shareUuid 없음');
    await page.goto(`/embed/${shareUuid}`);
    await expect(page.locator('body')).toContainText('E2E 대시보드', { timeout: 15000 });
    // 임베드는 크롬 없음 — 헤더 nav 없어야 함
    await expect(page.locator('nav')).toHaveCount(0);
  });

  test('로그아웃 → 로그인 페이지', async ({ page }) => {
    await login(page);
    // 헤더 우측 프로필 아바타 버튼(#styled-menu) → 팝오버의 '로그아웃' → 확인 팝업
    await page.locator('#styled-menu.MuiButton-text').last().click();
    await page.waitForTimeout(500);
    await page
      .locator('#transition-popper button', { hasText: /로그아웃|Sign out|Logout/ })
      .first()
      .click();
    // 로그아웃 확인 다이얼로그 — DialogActions의 첫 버튼이 액션(OK/확인)
    await page
      .locator('[role="dialog"] .MuiDialogActions-root button, .MuiDialog-root button')
      .first()
      .click({ timeout: 10000 });
    await page.waitForURL(/\/login/, { timeout: 15000 });
  });
});
