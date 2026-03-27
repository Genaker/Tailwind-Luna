import { test as base, expect } from '@playwright/test';

/** Patterns to ignore in console (third-party / known Magento noise in some setups). */
const IGNORE_CONSOLE = [
  /favicon/i,
  /ResizeObserver loop/i,
  /Failed to load resource.*(analytics|doubleclick|facebook|google-analytics)/i,
  // Dev/static mismatch: HTML SRI hash does not match deployed requirejs-config (fix deploy, not theme)
  /integrity.*requirejs-config|digest in the 'integrity'|computed SHA-256 integrity/i,
  // Broken static deploy (ko.js 404 or wrong MIME) — environment; run setup:static-content:deploy
  /Refused to execute script from.*ko\.js|MIME type \('text\/plain'\)/i,
  // Chrome logs URL-less 404s/502s for missing favicon/static or Warden hiccup; not actionable in theme tests
  /Failed to load resource: the server responded with a status of (404|502) \(\)/i,
];

function ignorePageError(message: string): boolean {
  if (/requirejs\.org\/docs\/errors/i.test(message) && /"ko"/i.test(message)) {
    return true;
  }
  return false;
}

function shouldIgnoreConsole(text: string): boolean {
  return IGNORE_CONSOLE.some((re) => re.test(text));
}

/**
 * Wraps the default page: collects uncaught exceptions and console.error,
 * then asserts the list is empty after each test (catches regressions early).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      if (ignorePageError(err.message)) {
        return;
      }
      errors.push(`[pageerror] ${err.message}`);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') {
        return;
      }
      const text = msg.text();
      if (!shouldIgnoreConsole(text)) {
        errors.push(`[console] ${text}`);
      }
    });
    await use(page);
    expect(errors, `No JS errors (got ${errors.length}): ${errors.join(' | ')}`).toEqual([]);
  },
});

export { expect } from '@playwright/test';
