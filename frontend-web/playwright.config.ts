import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 3 스모크 E2E: 프론트엔드만으로 검증 가능한 최소 범위.
 * 백엔드 없이 로그인 화면 렌더링과 라우팅 동작만 확인한다.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
