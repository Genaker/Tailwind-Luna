/**
 * Override via env when your sample data URLs differ (another store / locale / category tree).
 *
 * **Account E2E** (`e2e/account-journey.spec.ts`):
 * - **`E2E_USER_EMAIL` + `E2E_USER_PASSWORD`** — login only; user is assumed to exist (no registration).
 * - **`E2E_USER_EMAIL` only** — try login with the default E2E password first; if that succeeds, skip registration; otherwise create the account (first run).
 * - **Neither set** — register a new random user each run.
 *
 * **Resolve user:** `scripts/ensure-e2e-user.php` — env credentials, else **sample-data** `roni_cost@example.com` if present, else create fallback. See **`e2e/README.md`**, **`e2e/sampleAccounts.ts`**.
 */
export const e2e = {
  /** Search term that returns at least one simple (or addable) product in your catalog */
  searchQuery: process.env.E2E_SEARCH_QUERY ?? 'watch',
  /**
   * Relative path to a product detail page (Luma sample: Dash Digital Watch is often simple).
   * If unset, tests derive PDP from search results.
   */
  productPath: process.env.E2E_PRODUCT_PATH?.replace(/^\//, '') ?? '',
  /** Category URL path (leading slash). Luma sample often has men/tops-men.html */
  categoryPath: process.env.E2E_CATEGORY_PATH ?? '/men/tops-men.html',
  /**
   * Path to a configurable product with color swatches that have per-swatch images.
   * Luma sample: chaz-kangeroo-hoodie.html or mage/tops-men.html jacket variants.
   * Falls back to a search for E2E_SWATCH_SEARCH_QUERY (default: 'hoodie').
   */
  configurableProductPath: process.env.E2E_CONFIGURABLE_PRODUCT_PATH?.replace(/^\//, '') ?? 'gabrielle-micro-sleeve-top.html',
  swatchSearchQuery: process.env.E2E_SWATCH_SEARCH_QUERY ?? 'hoodie',
};
