/**
 * Gallery swatch bridge — image switching tests.
 *
 * #conf-gallery is keyed by child simple product ID. The bridge resolves the active variant from
 * ALL selected super attributes (color + size) via #gphp-config-index (jsonConfig.index).
 *
 * Verifies:
 *   1. [data-gphp-main] uses medium URLs
 *   2. Selecting a full variant (all attrs) swaps main + thumbnails to confGallery[childId]
 *   3. Thumbnail strip and lightbox behave after variant change
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/no-js-errors';
import { e2e } from './env';

type GalleryItem = {
  medium: string;
  full: string;
  thumb: string;
  small?: string;
  mobile: string;
  label: string;
};
type ConfEntry = { html: string; items: GalleryItem[]; mainIndex: number };
type ConfGallery = Record<string, ConfEntry>;
type IndexMap = Record<string, Record<string, string>>;

async function goToConfigurableProduct(page: Page): Promise<void> {
  const path = e2e.configurableProductPath || 'gabrielle-micro-sleeve-top.html';
  await page.goto(`/${path}`, { waitUntil: 'load' });
  await expect(page.locator('[data-gphp-gallery]')).toBeVisible({ timeout: 30_000 });
}

async function readConfGallery(page: Page): Promise<ConfGallery | null> {
  try {
    await page.waitForFunction(() => document.getElementById('conf-gallery') !== null, { timeout: 10_000 });
  } catch {
    return null;
  }
  return page.evaluate(() => {
    const el = document.getElementById('conf-gallery');
    if (!el) return null;
    try {
      return JSON.parse(el.textContent || '') as ConfGallery;
    } catch {
      return null;
    }
  });
}

async function readConfigIndex(page: Page): Promise<IndexMap | null> {
  return page.evaluate(() => {
    const el = document.getElementById('gphp-config-index');
    if (!el) return null;
    try {
      const o = JSON.parse(el.textContent || '{}') as { index?: IndexMap };
      return o.index ?? null;
    } catch {
      return null;
    }
  });
}

/** Pick two child IDs whose main medium URLs differ. */
function pickTwoDistinctChildIds(confGallery: ConfGallery): [string, string] | null {
  const ids = Object.keys(confGallery);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const ea = confGallery[a]?.items[confGallery[a]?.mainIndex ?? 0]?.medium ?? '';
      const eb = confGallery[b]?.items[confGallery[b]?.mainIndex ?? 0]?.medium ?? '';
      if (ea && eb && ea !== eb) return [a, b];
    }
  }
  return null;
}

function expectedSrc(confGallery: ConfGallery, childId: string): string {
  const entry = confGallery[childId];
  if (!entry) return '';
  const it = entry.items[entry.mainIndex] ?? entry.items[0];
  return (it?.medium || it?.full || '').split('?')[0];
}

/**
 * Click swatches / set selects so super attributes match index[childId] (full variant).
 */
async function applyVariant(page: Page, index: IndexMap, childId: string): Promise<void> {
  const row = index[childId];
  if (!row) return;

  const attrIds = Object.keys(row).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  for (const attrId of attrIds) {
    const optId = row[attrId];
    const sw = page.locator(`.swatch-option[data-option-id="${optId}"]:not(.disabled)`).first();
    if (await sw.isVisible().catch(() => false)) {
      await sw.click();
      await page.waitForTimeout(80);
      continue;
    }
    const sel = page.locator(`select[name="super_attribute[${attrId}]"]`).first();
    if (await sel.isVisible().catch(() => false)) {
      await sel.selectOption(optId);
      await page.waitForTimeout(80);
    }
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Gallery — swatch image switching', () => {
  test('initial [data-gphp-main] src is the medium image (not small)', async ({ page }) => {
    await goToConfigurableProduct(page);
    await expect(page.locator('[data-gphp-main]')).toBeVisible({ timeout: 30_000 });
    /* Let bridge sync pre-selected defaults */
    await page.waitForTimeout(300);

    const check = await page.evaluate(() => {
      const jsonEl = document.querySelector<HTMLScriptElement>('script[type="application/json"][id^="gphp-json-"]');
      if (!jsonEl) return { ok: false, reason: 'no gphp-json script' };
      let data: { mainIndex?: number; items?: Array<{ medium?: string; full?: string }> };
      try {
        data = JSON.parse(jsonEl.textContent || '{}');
      } catch {
        return { ok: false, reason: 'invalid json' };
      }
      const mainEl = document.querySelector('[data-gphp-main]');
      const src = (mainEl?.getAttribute('src') || '').split('?')[0];

      const idxEl = document.getElementById('gphp-config-index');
      const confEl = document.getElementById('conf-gallery');
      if (idxEl && confEl) {
        let index: IndexMap;
        let conf: ConfGallery;
        try {
          index = JSON.parse(idxEl.textContent || '{}').index;
          conf = JSON.parse(confEl.textContent || '{}');
        } catch {
          return { ok: false, reason: 'bad index/conf' };
        }

        const map: Record<string, string> = {};
        document.querySelectorAll('.swatch-attribute[data-attribute-id]').forEach((attrEl) => {
          const aid = attrEl.getAttribute('data-attribute-id');
          if (!aid) return;
          const s = attrEl.querySelector('.swatch-option.selected');
          if (s) {
            const oid = s.getAttribute('data-option-id') || s.getAttribute('option-id') || '';
            if (oid) map[aid] = oid;
          }
        });
        document.querySelectorAll('select.super-attribute-select').forEach((selEl) => {
          const name = selEl.getAttribute('name') || '';
          const m = name.match(/super_attribute\[(\d+)\]/);
          if (m && (selEl as HTMLSelectElement).value) map[m[1]] = (selEl as HTMLSelectElement).value;
        });
        document.querySelectorAll('input.super-attribute-select[type="hidden"]').forEach((inp) => {
          const name = inp.getAttribute('name') || '';
          const m = name.match(/super_attribute\[(\d+)\]/);
          if (m && (inp as HTMLInputElement).value) map[m[1]] = (inp as HTMLInputElement).value;
        });

        const keys = Object.keys(map);
        let need = 0;
        for (const cid in index) {
          need = Object.keys(index[cid]).length;
          break;
        }
        if (need && keys.length >= need) {
          for (const cid in index) {
            const row = index[cid];
            let ok = true;
            for (const k of keys) {
              if (String(row[k] ?? '') !== String(map[k])) {
                ok = false;
                break;
              }
            }
            if (ok) {
              const it = conf[cid]?.items?.[conf[cid]?.mainIndex ?? 0];
              const want = (it?.medium || it?.full || '').split('?')[0];
              if (want && src === want) return { ok: true, src, mode: 'child' };
            }
          }
        }
      }

      const idx = typeof data.mainIndex === 'number' ? data.mainIndex : 0;
      const it = data.items?.[idx];
      if (!it) return { ok: false, reason: 'no items' };
      const want = (it.medium || it.full || '').split('?')[0];
      if (!want || !src) return { ok: false, reason: 'empty url', src, want };
      if (src !== want) return { ok: false, reason: 'src !== medium|full', src, want };
      return { ok: true, src, mode: 'parent' };
    });
    expect(check.ok, JSON.stringify(check)).toBe(true);
  });

  test('gallery API exposes showItem / reset / refreshState / items', async ({ page }) => {
    await goToConfigurableProduct(page);
    await expect(page.locator('[data-gphp-main]')).toBeVisible({ timeout: 30_000 });

    const exposed = await page.evaluate(() => {
      const g = window.gphpGalleries;
      if (!g) return { ok: false, reason: 'no gphpGalleries' };
      const api = Object.values(g)[0];
      if (!api) return { ok: false, reason: 'no gallery entry' };
      const missing: string[] = [];
      if (typeof api.showItem !== 'function') missing.push('showItem');
      if (typeof api.reset !== 'function') missing.push('reset');
      if (typeof api.refreshState !== 'function') missing.push('refreshState');
      if (!Array.isArray(api.items)) missing.push('items[]');
      return missing.length ? { ok: false, reason: 'missing: ' + missing.join(', ') } : { ok: true };
    });
    expect(exposed.ok, JSON.stringify(exposed)).toBe(true);
  });

  test('full variant selection replaces main image AND thumbnails (child id)', async ({ page }) => {
    await goToConfigurableProduct(page);
    await expect(page.locator('[data-gphp-main]')).toBeVisible({ timeout: 30_000 });

    const confGallery = await readConfGallery(page);
    const index = await readConfigIndex(page);
    if (!confGallery || !index) {
      test.skip(true, '#conf-gallery or #gphp-config-index missing');
      return;
    }

    await page.waitForFunction(() => document.querySelectorAll('.swatch-option').length > 0, {
      timeout: 30_000,
    });

    const pair = pickTwoDistinctChildIds(confGallery);
    if (!pair) {
      test.skip(true, 'Need two child variants with different main images');
      return;
    }
    const [child1, child2] = pair;

    const mainImg = page.locator('[data-gphp-main]');
    const thumbsWrap = page.locator('[data-gphp-gallery] [data-gphp-thumbs]');
    const thumbBtns = page.locator('[data-gphp-gallery] [data-gphp-thumb]');

    await applyVariant(page, index, child1);
    await page.waitForTimeout(250);

    const want1 = expectedSrc(confGallery, child1);
    const src1 = ((await mainImg.getAttribute('src')) || '').split('?')[0];
    expect(src1, `Variant ${child1} main img`).toBe(want1);
    const entry1 = confGallery[child1]!;
    await expect(thumbBtns).toHaveCount(entry1.items.length);
    if (entry1.items.length <= 1) {
      await expect(thumbsWrap).toHaveAttribute('hidden', '');
    } else {
      await expect(thumbsWrap).not.toHaveAttribute('hidden');
    }

    await applyVariant(page, index, child2);
    await page.waitForTimeout(250);

    const want2 = expectedSrc(confGallery, child2);
    const src2 = ((await mainImg.getAttribute('src')) || '').split('?')[0];
    expect(src2, `Variant ${child2} main img`).toBe(want2);
    const entry2 = confGallery[child2]!;
    await expect(thumbBtns).toHaveCount(entry2.items.length);

    expect(src1, 'Two variants must differ').not.toBe(src2);
  });

  test('thumbnail click updates [data-gphp-main] within the variant', async ({ page }) => {
    await goToConfigurableProduct(page);
    await expect(page.locator('[data-gphp-main]')).toBeVisible({ timeout: 30_000 });

    const confGallery = await readConfGallery(page);
    const index = await readConfigIndex(page);
    if (!confGallery || !index) {
      test.skip(true, 'missing conf/index');
      return;
    }
    await page.waitForFunction(() => document.querySelectorAll('.swatch-option').length > 0, {
      timeout: 30_000,
    });

    let multiChild: string | null = null;
    for (const cid of Object.keys(confGallery)) {
      if (confGallery[cid]!.items.length >= 2) {
        multiChild = cid;
        break;
      }
    }
    if (!multiChild) {
      test.skip(true, 'No variant with > 1 gallery image');
      return;
    }

    await applyVariant(page, index, multiChild);
    await page.waitForTimeout(250);

    const entry = confGallery[multiChild]!;
    const thumb1 = page.locator('[data-gphp-gallery] [data-gphp-thumb="1"]');
    await expect(thumb1).toBeVisible({ timeout: 5_000 });
    await thumb1.click();
    await page.waitForTimeout(120);

    const expectedSecondSrc = (entry.items[1]?.medium || '').split('?')[0];
    const actualSrc = ((await page.locator('[data-gphp-main]').getAttribute('src')) || '').split('?')[0];
    expect(actualSrc).toBe(expectedSecondSrc);
  });

  test('lightbox opens after variant selection', async ({ page }) => {
    await goToConfigurableProduct(page);
    const mainImg = page.locator('[data-gphp-main]');
    await expect(mainImg).toBeVisible({ timeout: 30_000 });

    const confGallery = await readConfGallery(page);
    const index = await readConfigIndex(page);
    if (confGallery && index) {
      await page.waitForFunction(() => document.querySelectorAll('.swatch-option').length > 0, {
        timeout: 30_000,
      });
      const firstChild = Object.keys(confGallery)[0];
      if (firstChild) {
        await applyVariant(page, index, firstChild);
        await page.waitForTimeout(250);
      }
    }

    const mainSrcBeforeOpen = ((await mainImg.getAttribute('src')) || '').split('?')[0];
    expect(mainSrcBeforeOpen).toBeTruthy();

    await mainImg.click();
    const lightbox = page.locator('[data-gphp-lightbox]');
    await expect(lightbox).toBeVisible({ timeout: 5_000 });
    const popupImg = lightbox.locator('[data-gphp-popup-img]');
    await expect(popupImg).toHaveAttribute('src', /.+/, { timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden({ timeout: 5_000 });
  });
});

declare global {
  interface Window {
    gphpGalleries?: Record<
      string,
      {
        showItem: (idx: number) => void;
        reset: () => void;
        refreshState: (newItems: GalleryItem[], mainIdx: number) => void;
        syncPictureSources: (it: object) => void;
        readonly main: HTMLImageElement | null;
        items: GalleryItem[];
      }
    >;
  }
}
