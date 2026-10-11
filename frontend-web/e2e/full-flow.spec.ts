import { expect, test, Page } from '@playwright/test';
import path from 'node:path';

/**
 * 실 서버 연동 E2E — 로그인 → 파일 분석(브라우저 DuckDB) → 데이터셋 저장(서버 업로드)
 * 실행 전제: backend :4000, frontend :3000
 * 계정: wstester/test1234! (없으면 자동 생성)
 */

const TEST_USER = { userId: process.env.E2E_USER_ID ?? 'e2etester', password: process.env.E2E_PASSWORD ?? 'Test1234!' };

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[name="userId"]').fill(TEST_USER.userId);
  await page.locator('input[name="userPwd"]').fill(TEST_USER.password);
  await page.locator('button[type="submit"]').click();
  // 로그인 성공 시 /dashboard 등으로 이동
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
}

async function waitEngineReady(page: Page) {
  // 엔진 로딩 중엔 버튼이 disabled — 활성화될 때까지 대기
  const btn = page
    .locator(
      'button:has-text("파일 선택"), button:has-text("Choose file"), button:has-text("Select file"), button:has-text("CHOOSE FILE")',
    )
    .first();
  await expect(btn).toBeEnabled({ timeout: 60000 });
}

test.describe('실서버 E2E', () => {
  test('로그인 → 대시보드 진입', async ({ page }) => {
    await login(page);
    expect(page.url()).not.toContain('/login');
    // 사이드바/헤더 존재 확인
    await expect(page.locator('header, nav').first()).toBeVisible({ timeout: 10000 });
  });

  test('CSV 파일 분석 → SQL 쿼리 → 차트 미리보기', async ({ page }) => {
    await login(page);
    await page.goto('/data/file');

    // 파일 업로드 (hidden input)
    await waitEngineReady(page);
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures/generated/sales.csv'));
    // DuckDB 로딩 + 미리보기 렌더링 대기
    await expect(page.locator('.tui-grid-container, canvas, table').first()).toBeVisible({ timeout: 30000 });

    // SQL 실행 (기본 쿼리가 있으면 그대로, 없으면 입력)
    const queryInput = page.locator('input.MuiInputBase-input').first();
    await queryInput.fill('SELECT category, SUM(amount) AS total FROM uploaded_data GROUP BY category ORDER BY total DESC');
    await page.locator('button:has-text("실행"), button:has-text("Run")').first().click();
    await expect(page.locator('.tui-grid-body-area')).toContainText('60550');
    const valueSelect = page.locator('.MuiFormControl-root').filter({ has: page.locator('.MuiInputLabel-root').filter({ hasText: /^(값|Value)$/ }) }).getByRole('combobox');
    await valueSelect.click();
    await page.getByRole('option', { name: 'total', exact: true }).click();

    // 차트 타입 선택 → 미리보기
    const chartSelect = page.locator('div[role="combobox"], .MuiSelect-select').first();
    await expect(chartSelect).toBeVisible();
    await chartSelect.click();
    await page.locator('li[role="option"], .MuiMenuItem-root').first().click();
    await expect(page.locator('.echarts-for-react canvas').first()).toBeVisible();
  });

  test('Parquet 파일 분석', async ({ page }) => {
    await login(page);
    await page.goto('/data/file');
    await waitEngineReady(page);
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures/generated/users.parquet'));
    await expect(page.locator('.tui-grid-container, canvas, table').first()).toBeVisible({ timeout: 30000 });
  });

  test('JSON 파일 분석', async ({ page }) => {
    await login(page);
    await page.goto('/data/file');
    await waitEngineReady(page);
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures/generated/sensors.json'));
    await expect(page.locator('.tui-grid-container, canvas, table').first()).toBeVisible({ timeout: 30000 });
  });

  test('CSV → 서버 업로드 → 데이터셋 생성 완료', async ({ page }) => {
    await login(page);
    await page.goto('/data/file');
    await waitEngineReady(page);
    await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures/generated/sales.csv'));
    await expect(page.locator('.tui-grid-container, canvas, table').first()).toBeVisible({ timeout: 30000 });

    // "데이터셋으로 저장" 버튼 → 업로드 → /data/set/create 이동
    const saveBtn = page.locator('button:has-text("데이터셋"), button:has-text("dataset")').last();
    await saveBtn.click();
    await page.waitForURL(/\/data\/set\//, { timeout: 30000 });

    // 제목 입력 → Run으로 쿼리 검증 → 저장
    const titleInput = page.locator('input#userSetName, input[name="userSetName"]').first();
    await titleInput.fill('E2E 매출 데이터셋');
    await page.locator('button:has-text("Run")').first().click();
    // 쿼리 결과 그리드 표시 대기
    await expect(page.locator('.tui-grid-container, table').first()).toBeVisible({ timeout: 20000 });
    // 저장 버튼 (테스트 완료 후 활성화)
    const confirmBtn = page.locator('button:has-text("저장"), button:has-text("Save")').last();
    await expect(confirmBtn).toBeEnabled({ timeout: 15000 });
    await confirmBtn.click();
    // 확인 팝업 → Confirm
    await page.locator('button:has-text("Confirm"), button:has-text("확인")').first().click();
    await page.waitForURL(/\/data\/?$/, { timeout: 15000 });
  });

  test('언어 전환 (한→영)', async ({ page }) => {
    await login(page);
    await page.goto('/data/file');
    // 헤더 언어 셀렉트
    const langSelect = page.locator('nav.MuiAppBar-root .MuiSelect-select:visible');
    await expect(langSelect).toBeVisible();
    await langSelect.click();
    await page.locator('li:has-text("English")').click();
    await expect(page.locator('body')).toContainText(/file|analysis|upload/i);
  });
});
