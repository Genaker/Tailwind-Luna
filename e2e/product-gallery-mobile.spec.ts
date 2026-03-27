import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/no-js-errors';
import { e2e } from './env';

async function openProductDetailPage(page: Page): Promise<void> {
  if (e2e.productPath) {
    await page.goto(`/${e2e.productPath}`, { waitUntil: 'load' });
    return;
  }
  const q = encodeURIComponent(e2e.searchQuery);
  await page.goto(`/catalogsearch/result/?q=${q}`, { waitUntil: 'load' });
  const card = page.locator('.products-grid .product-item, .products.list .product-item').first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.locator('a.product-item-link, a.product-item-photo').first().click();
  await expect(page.locator('#product_addtocart_form, [data-container=product-info]')).toBeVisible({
    timeout: 30_000,
  });
}

type GalleryJson = {
  mainIndex?: number;
  items?: Array<{ mobile?: string }>;
  widths?: { mobile?: number; medium?: number; full?: number };
};

test.describe('Product gallery — mobile image width', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('theme uses 400px profile for mobile (view.xml default)', async ({ page }) => {
    await openProductDetailPage(page);

    const jsonScript = page.locator('script[type="application/json"][id^="gphp-json-"]');
    await expect(jsonScript).toBeAttached({ timeout: 30_000 });
    const data = JSON.parse((await jsonScript.textContent()) ?? '{}') as GalleryJson;

    expect(data.widths?.mobile).toBe(400);

    const idx = typeof data.mainIndex === 'number' ? data.mainIndex : 0;
    const mobileUrl = data.items?.[idx]?.mobile ?? '';
    const mobileSrcset = await page.locator('source[data-gphp-mobile-source]').getAttribute('srcset');
    expect(mobileSrcset).toBeTruthy();

    if (mobileUrl !== '') {
      const file = mobileUrl.split('?')[0].split('/').pop() ?? '';
      expect(mobileSrcset, 'mobile <source> should list medium_mobile URL (react Luma–style plain srcset)').toContain(
        file,
      );
    }
  });
});
