/**
 * Production / deployment check: global Tailwind must load as **tailwind.min.css**
 * (Genaker_ThemeTailwindLuna ResolveCss prefers css/tailwind.min.css when the file exists
 * in pub/static — see emit-tailwind-min-alias.cjs (cssnano) + copy-tailwind-to-pub.cjs).
 *
 * Run after: `npm run build:tailwind` or `npm run build:tailwind:prod` so
 * pub/static/.../css/tailwind.min.css exists.
 */
import { test, expect } from './fixtures/no-js-errors';

test.describe('Deployment — Tailwind min CSS', () => {
  test('home page links ResolveCss stylesheet as tailwind.min.css', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res?.ok(), `home HTTP ${res?.status()}`).toBeTruthy();

    /* Avoid matching theme path "tailwind_luna" — target the /css/tailwind*.css asset only. */
    const link = page.locator('head link[rel="stylesheet"][href*="/css/tailwind"]');
    await expect(link).toHaveCount(1, { timeout: 30_000 });

    const href = await link.getAttribute('href');
    expect(href, 'ResolveCss should prefer tailwind.min.css when deployed').toMatch(/\/css\/tailwind\.min\.css(\?|$)/);

    /* Sanity: asset responds (same-origin static). */
    const abs = new URL(href ?? '', page.url()).href;
    const cssRes = await page.request.get(abs);
    expect(cssRes.ok(), `GET ${abs} → ${cssRes.status()}`).toBeTruthy();
    expect(cssRes.headers()['content-type'] ?? '').toMatch(/text\/css|stylesheet/i);
  });
});
