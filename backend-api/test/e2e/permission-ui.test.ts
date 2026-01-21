import { test, expect, Page } from '@playwright/test';
import { PermissionTestUtils } from '../utils/permission-test.utils';
import { PermissionUITestHelpers } from './permission-ui-helpers';

// 테스트 환경 설정
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

test.describe('Frontend Permission Control', () => {
  let testUtils: PermissionTestUtils;
  
  test.beforeAll(async () => {
    // 테스트 유틸리티 초기화 (실제 구현 시 수정 필요)
    // testUtils = new PermissionTestUtils(app);
  });

  test.describe('Admin Dashboard Access', () => {
    test('should show admin menu only to authorized users', async ({ page }) => {
      // Admin 사용자 생성 및 로그인
      const adminCredentials = {
        userId: 'test_admin',
        password: 'Admin123!',
      };
      
      await PermissionUITestHelpers.loginWithCredentials(page, adminCredentials);
      
      // Admin 메뉴가 표시되는지 확인
      await expect(page.locator('[data-testid="admin-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-management-menu"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-management-menu"]')).toBeVisible();
    });

    test('should hide admin menu from unauthorized users', async ({ page }) => {
      // Editor 사용자로 로그인
      const editorCredentials = {
        userId: 'test_editor',
        password: 'Editor123!',
      };
      
      await PermissionUITestHelpers.loginWithCredentials(page, editorCredentials);
      
      // Admin 페이지 접근 시도
      await page.goto(`${BASE_URL}/admin`);
      
      // 접근 거부 메시지 확인
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
      await expect(page.getByText('접근 권한이 없습니다')).toBeVisible();
    });

    test('should redirect to login when not authenticated', async ({ page }) => {
      // 인증 없이 admin 페이지 접근
      await page.goto(`${BASE_URL}/admin`);
      
      // 로그인 페이지로 리다이렉트 확인
      await expect(page).toHaveURL(/.*\/login/);
    });
  });

  test.describe('User Management UI Controls', () => {
    test('should show/hide buttons based on permissions', async ({ page }) => {
      // Admin 권한으로 로그인
      const adminCredentials = {
        userId: 'test_admin',
        password: 'Admin123!',
      };
      
      await PermissionUITestHelpers.loginWithCredentials(page, adminCredentials);
      await page.goto(`${BASE_URL}/admin/users`);
      
      // 권한이 있는 버튼들이 표시되는지 확인
      const buttonChecks = await PermissionUITestHelpers.checkButtonPermissions(page, [
        { selector: '[data-testid="create-user-button"]', shouldBeVisible: true },
        { selector: '[data-testid="edit-user-button"]', shouldBeVisible: true },
        { selector: '[data-testid="delete-user-button"]', shouldBeVisible: true },
      ]);
      
      expect(buttonChecks.passed).toBe(true);
    });

    test('should disable restricted actions for limited permissions', async ({ page }) => {
      // 제한된 권한으로 로그인 (조회만 가능)
      const viewerCredentials = {
        userId: 'test_viewer',
        password: 'Viewer123!',
      };
      
      await PermissionUITestHelpers.loginWithCredentials(page, viewerCredentials);
      await page.goto(`${BASE_URL}/admin/users`);
      
      // 조회는 가능하지만 생성/수정/삭제 버튼은 비활성화되어야 함
      await expect(page.locator('[data-testid="users-table"]')).toBeVisible();
      
      const buttonChecks = await PermissionUITestHelpers.checkButtonPermissions(page, [
        { selector: '[data-testid="create-user-button"]', shouldBeVisible: false },
        { selector: '[data-testid="edit-user-button"]', shouldBeVisible: false },
        { selector: '[data-testid="delete-user-button"]', shouldBeVisible: false },
      ]);
      
      expect(buttonChecks.passed).toBe(true);
    });
  });

  test.describe('Dynamic Permission Updates', () => {
    test('should update UI when user permissions change', async ({ page }) => {
      // Viewer로 로그인
      const viewerCredentials = {
        userId: 'test_viewer',
        password: 'Viewer123!',
      };
      
      await PermissionUITestHelpers.loginWithCredentials(page, viewerCredentials);
      await page.goto(`${BASE_URL}/dashboard`);
      
      // 초기에는 Admin 메뉴가 없어야 함
      const adminMenuVisible = await page.locator('[data-testid="admin-menu-link"]').isVisible();
      expect(adminMenuVisible).toBe(false);
      
      // 권한 새로고침 (실제 구현에서는 백엔드에서 권한 변경 후)
      await PermissionUITestHelpers.refreshPermissions(page);
      
      // 권한 변경 후 확인 (테스트 환경에서는 시뮬레이션)
      // 실제 테스트에서는 백엔드 API를 통해 권한을 변경해야 함
    });
  });

  test.describe('Role-based Navigation', () => {
    test('should show different navigation items based on role', async ({ page }) => {
      const testCases = [
        {
          role: 'super_admin',
          expectedMenus: [
            { selector: '[data-testid="dashboard-menu"]', shouldBeVisible: true },
            { selector: '[data-testid="admin-menu"]', shouldBeVisible: true },
            { selector: '[data-testid="reports-menu"]', shouldBeVisible: true },
            { selector: '[data-testid="settings-menu"]', shouldBeVisible: true },
          ],
        },
        {
          role: 'manager',
          expectedMenus: [
            { selector: '[data-testid="dashboard-menu"]', shouldBeVisible: true },
            { selector: '[data-testid="admin-menu"]', shouldBeVisible: false },
            { selector: '[data-testid="reports-menu"]', shouldBeVisible: true },
            { selector: '[data-testid="settings-menu"]', shouldBeVisible: true },
          ],
        },
        {
          role: 'viewer',
          expectedMenus: [
            { selector: '[data-testid="dashboard-menu"]', shouldBeVisible: true },
            { selector: '[data-testid="admin-menu"]', shouldBeVisible: false },
            { selector: '[data-testid="reports-menu"]', shouldBeVisible: true },
            { selector: '[data-testid="settings-menu"]', shouldBeVisible: false },
          ],
        },
      ];

      for (const testCase of testCases) {
        await test.step(`Testing navigation for ${testCase.role}`, async () => {
          // 해당 역할로 로그인
          const credentials = {
            userId: `test_${testCase.role}`,
            password: 'Password123!',
          };
          
          await PermissionUITestHelpers.loginWithCredentials(page, credentials);
          
          // 메뉴 권한 확인
          const menuChecks = await PermissionUITestHelpers.checkMenuPermissions(
            page,
            testCase.expectedMenus
          );
          
          expect(menuChecks.passed).toBe(true);
          
          // 로그아웃
          await PermissionUITestHelpers.logout(page);
        });
      }
    });
  });

  test.describe('Form Field Permissions', () => {
    test('should disable sensitive fields based on permissions', async ({ page }) => {
      // 제한된 권한으로 로그인
      const editorCredentials = {
        userId: 'test_editor',
        password: 'Editor123!',
      };
      
      await PermissionUITestHelpers.loginWithCredentials(page, editorCredentials);
      await page.goto(`${BASE_URL}/admin/settings`);
      
      // 민감한 설정 필드가 비활성화되어 있는지 확인
      await expect(page.locator('[data-testid="system-config-field"]')).toBeDisabled();
      await expect(page.locator('[data-testid="security-settings-field"]')).toBeDisabled();
      
      // 일반 설정은 활성화되어 있어야 함
      await expect(page.locator('[data-testid="display-settings-field"]')).toBeEnabled();
    });
  });

  test.describe('Bulk Actions Permissions', () => {
    test('should show bulk actions only with appropriate permissions', async ({ page }) => {
      // Admin으로 로그인
      const adminCredentials = {
        userId: 'test_admin',
        password: 'Admin123!',
      };
      
      await PermissionUITestHelpers.loginWithCredentials(page, adminCredentials);
      await page.goto(`${BASE_URL}/admin/users`);
      
      // 여러 항목 선택
      await page.click('[data-testid="select-all-checkbox"]');
      
      // 대량 작업 버튼이 표시되는지 확인
      await expect(page.locator('[data-testid="bulk-delete-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="bulk-export-button"]')).toBeVisible();
    });

    test('should hide bulk actions for limited permissions', async ({ page }) => {
      // Viewer로 로그인
      const viewerCredentials = {
        userId: 'test_viewer',
        password: 'Viewer123!',
      };
      
      await PermissionUITestHelpers.loginWithCredentials(page, viewerCredentials);
      await page.goto(`${BASE_URL}/admin/users`);
      
      // 선택 체크박스 자체가 없어야 함
      await expect(page.locator('[data-testid="select-all-checkbox"]')).not.toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should show appropriate error for permission denied', async ({ page }) => {
      // Editor로 로그인
      const editorCredentials = {
        userId: 'test_editor',
        password: 'Editor123!',
      };
      
      await PermissionUITestHelpers.loginWithCredentials(page, editorCredentials);
      
      // 권한이 없는 API 직접 호출 시도
      const response = await page.request.delete(`${BASE_URL}/api/admin/users/123`, {
        headers: {
          'Authorization': `Bearer ${await page.evaluate(() => localStorage.getItem('accessToken'))}`,
        },
      });
      
      expect(response.status()).toBe(403);
      
      const body = await response.json();
      expect(body.message).toContain('권한');
    });
  });

  test.describe('Screenshot Tests', () => {
    test('should capture permission denied screens', async ({ page }) => {
      // 권한이 없는 사용자로 admin 페이지 접근
      const viewerCredentials = {
        userId: 'test_viewer',
        password: 'Viewer123!',
      };
      
      await PermissionUITestHelpers.loginWithCredentials(page, viewerCredentials);
      await page.goto(`${BASE_URL}/admin`);
      
      // 접근 거부 화면 스크린샷
      await PermissionUITestHelpers.captureScreenshot(page, 'permission-denied-admin');
    });
  });
});