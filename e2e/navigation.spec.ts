import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/no-js-errors';

/** Header hamburger only (drawer also has Close with the same data-action). */
function openMenuButton(page: Page) {
  return page.getByRole('button', { name: 'Open menu' });
}

/** Magento menu widget must be ready or toggle-nav does not toggle html.nav-open. */
async function loadHomeWithMenu(page: Page): Promise<void> {
  const res = await page.goto('/', { waitUntil: 'load' });
  expect(res?.ok(), `HTTP ${res?.status()}`).toBeTruthy();
  await expect(page.locator('#main-menu-primary')).toHaveClass(/ui-menu/, { timeout: 30_000 });
}

test.describe('Navigation — mobile drawer & accordion', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('hamburger opens drawer (html.nav-open) and Menu panel shows primary nav', async ({ page }) => {
    await loadHomeWithMenu(page);

    const toggle = openMenuButton(page);
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(page.locator('html')).toHaveClass(/nav-open/, { timeout: 20_000 });
    await expect(page.locator('.sections.nav-sections')).toBeVisible({ timeout: 15_000 });

    // Category tree lives in the Menu tab panel (id from layout, usually store.menu)
    const menuPanel = page.locator('[id="store.menu"]');
    await expect(menuPanel).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#main-menu-primary')).toBeVisible();
  });

  test('mobile: expanding a parent category shows its submenu', async ({ page }) => {
    await loadHomeWithMenu(page);
    await openMenuButton(page).click();
    await expect(page.locator('html')).toHaveClass(/nav-open/, { timeout: 20_000 });

    const parents = page.locator('#main-menu-primary > li.level0.parent');
    if ((await parents.count()) === 0) {
      test.skip(true, 'No nested categories in catalog');
    }
    const parentRoot = parents.first();
    const topLink = parentRoot.locator('> a.level-top').first();
    await topLink.click();

    const submenu = parentRoot.locator('> ul.submenu').first();
    await expect(submenu).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Navigation — desktop bar & flyout', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('top nav is visible, hamburger hidden; hover shows submenu flyout', async ({ page }) => {
    await loadHomeWithMenu(page);

    await expect(openMenuButton(page)).toBeHidden();
    await expect(page.locator('nav.navigation[aria-label="Category navigation"]')).toBeVisible();

    const parents = page.locator('#main-menu-primary > li.level0.parent');
    if ((await parents.count()) === 0) {
      test.skip(true, 'No nested categories in catalog');
    }
    const parentRoot = parents.first();
    await parentRoot.hover();
    const submenu = parentRoot.locator('> ul.submenu').first();
    await expect(submenu).toBeVisible({ timeout: 15_000 });
  });
});
