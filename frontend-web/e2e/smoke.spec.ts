import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
});

test.describe('smoke', () => {
  test('앱이 부팅되고 로그인 페이지가 렌더링된다', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/바닐라메타|로그인|Vanilla/i);
    await expect(page.getByLabel('User ID')).toBeVisible();
    await expect(page.getByLabel(/^Password\s*\*?$/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeEnabled();
  });

  test('보호된 라우트는 로그인으로 리다이렉트된다', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
  });

  test('미인증 상태의 알 수 없는 경로는 로그인 화면으로 이동한다', async ({ page }) => {
    // The protected layout owns the wildcard route as well as known routes.
    const response = await page.goto('/nonexistent-route');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('User ID')).toBeVisible();
    await expect(page.getByLabel(/^Password\s*\*?$/)).toBeVisible();
  });
});
