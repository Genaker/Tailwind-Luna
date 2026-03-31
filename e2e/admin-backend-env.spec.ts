/**
 * Opens the admin URL using backend.frontName from app/etc/env.php (same as Magento).
 * Asserts no JS console errors (fixture) and no PHP/Exception text in body.
 */
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures/no-js-errors';
import { getAdminPathFromEnvPhp, resolveMagentoRoot } from './lib/magentoBackendPath';

/** Magento / PHP errors often surface in HTML body */
const BODY_ERROR = new RegExp(
  [
    'Cannot redeclare',
    'Fatal error',
    'There has been an error processing your request',
    'Exception #0',
    'ReflectionException',
    'Invalid block type',
    'Class .* does not exist',
  ].join('|'),
  'i',
);

test.describe('Admin URL from env.php', () => {
  test('backend entry loads with no console errors and no error text in body', async ({ page }) => {
    const adminPath = getAdminPathFromEnvPhp();
    const res = await page.goto(adminPath, { waitUntil: 'domcontentloaded' });

    expect(res?.status(), `GET ${adminPath} → HTTP ${res?.status()}`).not.toBe(500);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText, 'body should not show Magento/PHP errors').not.toMatch(BODY_ERROR);

    await expect(page.locator('#username')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#login')).toBeVisible();
  });

  test('MAGENTO_ROOT contains app/etc/env.php with backend.frontName', () => {
    const root = resolveMagentoRoot();
    expect(fs.existsSync(path.join(root, 'app', 'etc', 'env.php'))).toBe(true);
    expect(getAdminPathFromEnvPhp(root)).toMatch(/^\/[\w-]+$/);
  });
});
