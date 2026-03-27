import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/no-js-errors';
import { e2e } from './env';

async function openProductDetailPage(page: Page): Promise<void> {
  if (e2e.productPath) {
    await page.goto(`/${e2e.productPath}`, { waitUntil: 'domcontentloaded' });
    return;
  }
  const q = encodeURIComponent(e2e.searchQuery);
  await page.goto(`/catalogsearch/result/?q=${q}`, { waitUntil: 'domcontentloaded' });
  const card = page.locator('.products-grid .product-item, .products.list .product-item').first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.locator('a.product-item-link, a.product-item-photo').first().click();
  await expect(page.locator('#product_addtocart_form, [data-container=product-info]')).toBeVisible({
    timeout: 30_000,
  });
}

async function selectRequiredOptionsIfConfigurable(page: Page): Promise<void> {
  const swatch = page.locator('.swatch-attribute .swatch-option:not(.disabled)').first();
  if (await swatch.isVisible().catch(() => false)) {
    await swatch.click();
  }
  const select = page.locator('select.super-attribute-select').first();
  if (await select.isVisible().catch(() => false)) {
    const opts = await select.locator('option:not([value=""])').all();
    if (opts.length > 0) {
      const val = await opts[0].getAttribute('value');
      if (val) {
        await select.selectOption(val);
      }
    }
  }
}

async function addToCart(page: Page): Promise<void> {
  await selectRequiredOptionsIfConfigurable(page);
  const btn = page.locator('#product-addtocart-button, #product_addtocart_form button[type="submit"].tocart').first();
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await expect(btn).toBeEnabled({ timeout: 15_000 });
  await btn.click();
  await expect(
    page
      .locator('.message-success')
      .or(page.locator('[data-block=minicart] .counter.qty:not(.empty)')),
  ).toBeVisible({ timeout: 45_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

test.describe('Shopping journey', () => {
  test('search → PDP → add to cart → minicart → remove → cart → checkout', async ({ page }) => {
    await test.step('Home', async () => {
      const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(res?.ok(), `home HTTP ${res?.status()}`).toBeTruthy();
    });

    await test.step('Product page', async () => {
      await openProductDetailPage(page);
      await expect(page.locator('#product_addtocart_form')).toBeVisible({ timeout: 30_000 });
    });

    await test.step('Add to cart', async () => {
      await addToCart(page);
    });

    await test.step('Open minicart', async () => {
      await page.locator('[data-block=minicart] a.action.showcart').first().click();
      await expect(page.locator('#btn-minicart-close')).toBeVisible({ timeout: 25_000 });
      const line = page.locator('[data-block=minicart] #mini-cart li[data-role=product-item]').first();
      await expect(line).toBeVisible({ timeout: 25_000 });
    });

    await test.step('Remove from minicart', async () => {
      const remove = page
        .locator('[data-block=minicart] a.action.delete, [data-block=minicart] .action.delete')
        .or(page.getByRole('link', { name: /remove item/i }))
        .first();
      await expect(remove).toBeVisible({ timeout: 15_000 });
      await remove.click();
      // Magento minicart uses mage/confirm; overlay z-index can block Playwright clicks on OK.
      const confirmOk = page.locator('.modals-wrapper .modal-popup.confirm button.action-accept').last();
      await expect(confirmOk).toBeVisible({ timeout: 10_000 });
      await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === 'POST' && r.url().includes('checkout/sidebar/removeItem'),
          { timeout: 40_000 },
        ),
        confirmOk.evaluate((el: HTMLElement) => {
          el.click();
        }),
      ]);
      await expect(page.locator('[data-block=minicart] #mini-cart li[data-role=product-item]')).toHaveCount(0, {
        timeout: 25_000,
      });
    });

    await test.step('Add to cart again (for checkout)', async () => {
      await page.keyboard.press('Escape').catch(() => undefined);
      await openProductDetailPage(page);
      await addToCart(page);
    });

    await test.step('Go to cart page', async () => {
      await page.goto('/checkout/cart/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body.checkout-cart-index')).toBeAttached();
      await expect(page.locator('.cart.table-wrapper').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('tbody.cart.item, tr.cart.item').first()).toBeVisible({ timeout: 15_000 });
    });

    await test.step('Proceed to checkout', async () => {
      const proceed = page
        .locator('button[data-role=proceed-to-checkout], button.checkout, a.action.primary.checkout')
        .first();
      await expect(proceed).toBeVisible({ timeout: 15_000 });
      await proceed.click();
      const pathIsOnepageCheckout = (u: URL) => u.pathname.replace(/\/$/, '') === '/checkout';
      // Guest checkout off → proceed opens auth modal and stays on /checkout/cart/ — fall back to direct URL (valid quote).
      try {
        await page.waitForURL(pathIsOnepageCheckout, { timeout: 20_000 });
      } catch {
        await page.goto('/checkout/', { waitUntil: 'domcontentloaded' });
      }
      await expect(page).toHaveURL(pathIsOnepageCheckout, { timeout: 30_000 });
      await expect(page.locator('#checkout-loader')).toBeHidden({ timeout: 60_000 });
      // #checkout can stay hidden until UI/RequireJS bind; body class is the reliable signal.
      await expect(page.locator('body.checkout-index-index')).toBeVisible({ timeout: 30_000 });
    });
  });
});
