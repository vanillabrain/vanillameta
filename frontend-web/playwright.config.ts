import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const apiURL = process.env.E2E_API_URL || 'http://localhost:4000/v1';
const external = process.env.E2E_EXTERNAL_SERVER === '1';

// Explicit invocation only. Extended QA is selected through its own config.
export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: process.env.E2E_EVIDENCE_DIR || '/tmp/vanillameta-e2e-results',
  use: {
    baseURL,
    headless: process.env.E2E_HEADED !== '1',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 1000 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: external
    ? undefined
    : [
        {
          command: 'npm run start:local',
          cwd: '../backend-api',
          url: `${apiURL}/component`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
        { command: 'npm start', url: baseURL, reuseExistingServer: true, timeout: 30_000 },
      ],
});
