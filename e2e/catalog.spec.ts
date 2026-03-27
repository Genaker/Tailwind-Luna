import { test, expect } from './fixtures/no-js-errors';
import { e2e } from './env';

test.describe('Catalog', () => {
  test('category page renders grid or message', async ({ page }) => {
    const path = e2e.categoryPath.startsWith('/') ? e2e.categoryPath : `/${e2e.categoryPath}`;
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
    if (res?.status() === 404) {
      test.skip(true, `Category not found: ${path} — set E2E_CATEGORY_PATH`);
    }
    expect(res?.ok(), `HTTP ${res?.status()} for ${path}`).toBeTruthy();

    // PLP can contain both grid and list wrappers in DOM; use .first() to satisfy strict mode.
    const products = page.locator('.column.main .products-grid, .column.main .products.list');
    const empty = page.locator('.column.main .message.info.empty');
    await expect(products.first().or(empty.first())).toBeVisible({ timeout: 30_000 });
  });

  test('search results page', async ({ page }) => {
    const q = encodeURIComponent(e2e.searchQuery);
    const res = await page.goto(`/catalogsearch/result/?q=${q}`, { waitUntil: 'domcontentloaded' });
    expect(res?.ok(), `HTTP ${res?.status()}`).toBeTruthy();

    const hasResults = page.locator('.products-grid .product-item, .products.list .product-item');
    const noResults = page.locator('.message.notice, .message.info.empty');
    await expect(hasResults.or(noResults).first()).toBeVisible({ timeout: 30_000 });
  });
});
