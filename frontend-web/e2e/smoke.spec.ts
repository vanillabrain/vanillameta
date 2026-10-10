import { expect, test } from '@playwright/test';

test.describe('smoke', () => {
  test('앱이 부팅되고 로그인 페이지가 렌더링된다', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/바닐라메타|로그인|Vanilla/i);
    await expect(page.locator('input').first()).toBeVisible();
  });

  test('보호된 라우트는 로그인으로 리다이렉트된다', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/login/);
    expect(page.url()).toContain('/login');
  });

  test('존재하지 않는 경로도 앱이 렌더링된다', async ({ page }) => {
    const response = await page.goto('/nonexistent-route');
    expect(response?.status()).toBe(200);
  });
});
