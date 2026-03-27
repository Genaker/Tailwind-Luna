# End-to-end tests (Playwright)

## Resolving the test customer (`ensure-e2e-user.php`)

Magento core does **not** ship a `bin/magento customer:create …` command. This theme uses **`e2e/scripts/ensure-e2e-user.php`**, which loads Magento like `bin/magento` and prints **one JSON line** to stdout: `{ "email", "password", "source" }`.

**Order of resolution:**

1. **`E2E_USER_EMAIL` + `E2E_USER_PASSWORD`** — use as-is (`source`: `env`). Magento is not bootstrapped if both are set.
2. **Sample-data demo user** — if **`roni_cost@example.com`** exists in the DB (Magento sample data / `module-customer-sample-data`), use password **`roni_cost3@example.com`** (`source`: `sample_data`). Defined in `vendor/magento/module-customer-sample-data/fixtures/customer_profile.csv`.
3. **Fallback** — create or reuse **`e2e_playwright@example.test`** with **`TestPass123!`** (`source`: `created` or `fallback_exists`). Override via **`E2E_FALLBACK_EMAIL`** / **`E2E_FALLBACK_PASSWORD`**.

Stderr logs which branch was used; stdout is **JSON only** (for `run-e2e-with-user.cjs`).

### CLI: print resolved user

From the **theme package**:

```bash
cd packages/theme-frontend-win-luna
npm run e2e:create-user
```

Or from **Magento project root** (with PHP):

```bash
php packages/theme-frontend-win-luna/e2e/scripts/ensure-e2e-user.php
```

### Run Playwright with resolved user

```bash
cd packages/theme-frontend-win-luna
npm run test:e2e:with-user
```

This runs **`ensure-e2e-user.php`**, sets **`E2E_USER_EMAIL`** / **`E2E_USER_PASSWORD`** for Playwright, then runs tests. With **sample data** or **fallback**, Playwright uses **login-only** behaviour.

### Optional: delete user after tests

```bash
E2E_DELETE_USER=1 npm run test:e2e:with-user
```

Runs **`delete-e2e-customer.php`** only when the user was **not** resolved from sample data (`source !== sample_data`). Demo **`roni_cost@example.com`** is never deleted.

### `e2e/sampleAccounts.ts`

TypeScript constants for the sample-data email/password (same as CSV above).

### Env reference

| Variable | Purpose |
|----------|---------|
| `MAGENTO_ROOT` | Magento root (parent of `app/`). |
| `PHP_BIN` | PHP binary (default `php`). |
| `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` | Force credentials (skip DB lookup). |
| `E2E_FALLBACK_EMAIL` / `E2E_FALLBACK_PASSWORD` | Fallback when sample-data user is missing. |
| `SKIP_E2E_MAGENTO_USER` | `1` = skip PHP; defaults Playwright to **`roni_cost@example.com`** if no `E2E_USER_*` set. |
| `E2E_DELETE_USER` | `1` = delete resolved user after tests (not sample-demo). |

### Docker / CI without Magento

`npm run test:e2e` runs Playwright only. `test:e2e:docker` sets `SKIP_E2E_MAGENTO_USER=1`.

### Warden / Docker PHP

Run the PHP script inside the PHP container with `MAGENTO_ROOT` pointing at the project root inside the container (often `/var/www/html`).
