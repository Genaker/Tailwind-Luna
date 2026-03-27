import { test, expect } from './fixtures/no-js-errors';

test.describe('Home', () => {
  test('loads CMS shell and promo grid', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res?.ok(), `HTTP ${res?.status()}`).toBeTruthy();

    await expect(page.locator('[data-appearance="home-shell"]')).toBeVisible();
    await expect(page.locator('a.block-promo.home-main')).toBeVisible();
    await expect(page.locator('a.block-promo.home-pants')).toBeVisible();
    await expect(page.locator('a.block-promo.home-t-shirts')).toBeVisible();

    const heroImg = page.locator('a.home-main img[src*="wysiwyg/home/home-main"]').first();
    await expect(heroImg).toBeVisible();

    // Promos + Hot Sellers only (excludes optional CMS body below the shell column).
    const shellImages = page.locator('.cms-home > .flex.flex-col img');
    const n = await shellImages.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const loading = await shellImages.nth(i).getAttribute('loading');
      expect(loading, `img[${i}] loading`).toBe(i === 0 ? 'eager' : 'lazy');
    }
  });
});
