/**
 * Admin area: login page must not return PHP fatals (e.g. duplicate ResolveCss class).
 * Optional: after login, assert Tailwind admin theme injects css/tailwind.css (Genaker adminhtml theme).
 */
import { test, expect } from './fixtures/no-js-errors';
import { getAdminPathFromEnvPhp } from './lib/magentoBackendPath';

const FATAL_BODY = /Cannot redeclare|Fatal error|There has been an error processing your request/i;

function adminEntryUrl(): string {
  const full = process.env.PLAYWRIGHT_ADMIN_URL;
  if (full && /^https?:\/\//i.test(full)) {
    return full;
  }
  if (process.env.PLAYWRIGHT_ADMIN_PATH) {
    return process.env.PLAYWRIGHT_ADMIN_PATH;
  }
  try {
    return getAdminPathFromEnvPhp();
  } catch {
    return '/admin';
  }
}

test.describe('Admin — health and Tailwind', () => {
  test('admin login page is healthy (no PHP fatal)', async ({ page }) => {
    const res = await page.goto(adminEntryUrl(), { waitUntil: 'domcontentloaded' });
    expect(res?.status(), `admin entry HTTP ${res?.status()}`).not.toBe(500);

    const body = await page.locator('body').innerText();
    expect(body, 'page body should not expose PHP fatal').not.toMatch(FATAL_BODY);

    await expect(page.locator('#username')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#login')).toBeVisible();
  });

  test('admin loads Tailwind stylesheet after login', async ({ page }) => {
    const user = process.env.E2E_ADMIN_USER;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!user || !password, 'Set E2E_ADMIN_USER and E2E_ADMIN_PASSWORD to run this test');

    await page.goto(adminEntryUrl(), { waitUntil: 'domcontentloaded' });
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(FATAL_BODY);

    await page.locator('#username').fill(user!);
    await page.locator('#login').fill(password!);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.locator('#menu-magento-backend-content, .admin-user').first()).toBeVisible({
      timeout: 60_000,
    });

    const link = page.locator('head link[rel="stylesheet"][href*="/css/tailwind"]');
    await expect(link).toHaveCount(1, { timeout: 15_000 });
    const href = await link.getAttribute('href');
    expect(href ?? '', 'tailwind stylesheet href').toMatch(/\/css\/tailwind\.css(\?|$)/);
  });
});
