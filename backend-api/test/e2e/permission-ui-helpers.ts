import { Page } from '@playwright/test';
import { AuthTokens } from '../utils/permission-test.utils';

export interface LoginCredentials {
  userId: string;
  password: string;
}

export class PermissionUITestHelpers {
  static async loginAsUser(
    page: Page,
    tokens: AuthTokens,
  ): Promise<void> {
    // Set authentication token in localStorage
    await page.addInitScript((token) => {
      localStorage.setItem('accessToken', token);
    }, tokens.accessToken);

    // Set refresh token as cookie
    await page.context().addCookies([
      {
        name: 'jwt_re',
        value: tokens.refreshToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
  }

  static async loginWithCredentials(
    page: Page,
    credentials: LoginCredentials,
  ): Promise<void> {
    await page.goto('/login');
    
    // Fill login form
    await page.fill('[data-testid="login-userid"]', credentials.userId);
    await page.fill('[data-testid="login-password"]', credentials.password);
    
    // Submit login
    await page.click('[data-testid="login-submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  }

  static async checkPermission(
    page: Page,
    selector: string,
    shouldBeVisible: boolean,
  ): Promise<boolean> {
    try {
      if (shouldBeVisible) {
        await page.waitForSelector(selector, { timeout: 5000 });
        return await page.isVisible(selector);
      } else {
        // Check that element is not visible
        const isVisible = await page.isVisible(selector);
        return !isVisible;
      }
    } catch (error) {
      return !shouldBeVisible; // If timeout waiting for element, it's not visible
    }
  }

  static async checkMenuPermissions(
    page: Page,
    expectedMenus: { selector: string; shouldBeVisible: boolean }[],
  ): Promise<{ passed: boolean; results: any[] }> {
    const results = [];
    let allPassed = true;

    for (const menu of expectedMenus) {
      const isCorrect = await this.checkPermission(
        page,
        menu.selector,
        menu.shouldBeVisible,
      );
      
      results.push({
        selector: menu.selector,
        expected: menu.shouldBeVisible,
        actual: await page.isVisible(menu.selector),
        passed: isCorrect,
      });

      if (!isCorrect) {
        allPassed = false;
      }
    }

    return { passed: allPassed, results };
  }

  static async checkButtonPermissions(
    page: Page,
    buttons: { selector: string; shouldBeVisible: boolean; shouldBeEnabled?: boolean }[],
  ): Promise<{ passed: boolean; results: any[] }> {
    const results = [];
    let allPassed = true;

    for (const button of buttons) {
      const isVisible = await page.isVisible(button.selector);
      const visibilityCorrect = isVisible === button.shouldBeVisible;
      
      let enabledCorrect = true;
      let isEnabled = null;
      
      if (isVisible && button.shouldBeEnabled !== undefined) {
        isEnabled = await page.isEnabled(button.selector);
        enabledCorrect = isEnabled === button.shouldBeEnabled;
      }

      const passed = visibilityCorrect && enabledCorrect;
      
      results.push({
        selector: button.selector,
        expectedVisible: button.shouldBeVisible,
        actualVisible: isVisible,
        expectedEnabled: button.shouldBeEnabled,
        actualEnabled: isEnabled,
        passed,
      });

      if (!passed) {
        allPassed = false;
      }
    }

    return { passed: allPassed, results };
  }

  static async navigateAndCheckAccess(
    page: Page,
    url: string,
    shouldHaveAccess: boolean,
  ): Promise<{ hasAccess: boolean; finalUrl: string }> {
    await page.goto(url);
    await page.waitForLoadState('networkidle');

    const finalUrl = page.url();
    const hasAccess = !finalUrl.includes('/403') && !finalUrl.includes('/unauthorized');

    return {
      hasAccess: hasAccess === shouldHaveAccess,
      finalUrl,
    };
  }

  static async refreshPermissions(page: Page): Promise<void> {
    // Click user menu
    await page.click('[data-testid="user-profile-menu"]');
    
    // Click refresh permissions option if available
    const refreshButton = '[data-testid="refresh-permissions"]';
    if (await page.isVisible(refreshButton)) {
      await page.click(refreshButton);
      await page.waitForTimeout(1000); // Wait for permissions to refresh
    }
  }

  static async logout(page: Page): Promise<void> {
    // Click user menu
    await page.click('[data-testid="user-profile-menu"]');
    
    // Click logout
    await page.click('[data-testid="logout-button"]');
    
    // Wait for redirect to login page
    await page.waitForURL('**/login', { timeout: 10000 });
  }

  static async captureScreenshot(
    page: Page,
    name: string,
  ): Promise<void> {
    await page.screenshot({
      path: `test/screenshots/${name}-${Date.now()}.png`,
      fullPage: true,
    });
  }
}