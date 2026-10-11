import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';

const evidence = process.env.QA_EVIDENCE_DIR;
if (!evidence || !process.env.QA_RUN_ROOT || !process.env.E2E_API_URL || !process.env.E2E_BASE_URL) {
  throw new Error('Run comprehensive E2E through e2e/qa-runtime.mjs --run to provide an isolated local runtime.');
}

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'qa/**/*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  webServer: undefined,
  use: {
    ...base.use,
    baseURL: process.env.E2E_BASE_URL,
    screenshot: 'only-on-failure',
  },
  outputDir: path.join(evidence, 'artifacts'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(evidence, 'playwright-results.json') }],
    ['html', { outputFolder: path.join(evidence, 'html-report'), open: 'never' }],
  ],
});
