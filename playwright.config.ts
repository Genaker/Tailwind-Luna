import path from 'path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://app.luma.test';

/** Use when project `test-results/` is not writable (e.g. root-owned). */
const artifactRoot = process.env.PLAYWRIGHT_ARTIFACT_ROOT ?? process.cwd();
const outputDir = path.join(artifactRoot, 'test-results');
const reportDir = path.join(artifactRoot, 'playwright-report');

export default defineConfig({
  testDir: 'e2e',
  outputDir,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: reportDir }]]
    : [['list'], ['html', { open: 'never', outputFolder: reportDir }]],
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
