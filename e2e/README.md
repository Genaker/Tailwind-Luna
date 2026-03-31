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

### Admin URL from `app/etc/env.php` (`e2e/admin-backend-env.spec.ts`)

Reads **`backend.frontName`** from **`MAGENTO_ROOT/app/etc/env.php`** (e.g. `backend` → opens **`/backend`** under `PLAYWRIGHT_BASE_URL`). Asserts **no console errors** (via the shared fixture) and **no PHP/Exception text** in the page body.

| Variable | Purpose |
|----------|---------|
| `MAGENTO_ROOT` | Magento root (parent of `app/`). Default: four levels above `e2e/lib` (project root when the theme lives at `packages/theme-frontend-win-luna`). |
| `MAGENTO_BACKEND_FRONTNAME` | Optional override if you do not want to read `env.php` (e.g. `backend`). |

```bash
cd packages/theme-frontend-win-luna
npm run test:e2e:admin-backend
```

### Admin (`e2e/admin-tailwind.spec.ts`)

Same admin path resolution as above: unless **`PLAYWRIGHT_ADMIN_URL`** or **`PLAYWRIGHT_ADMIN_PATH`** is set, the path comes from **`env.php`** `backend.frontName` (fallback **`/admin`** if `env.php` is missing). Optionally logs in and asserts **`css/tailwind.css`** is linked (Genaker adminhtml Tailwind theme).

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_ADMIN_PATH` | Path relative to `PLAYWRIGHT_BASE_URL` (overrides `env.php` when set). |
| `PLAYWRIGHT_ADMIN_URL` | Full URL override for the admin entry (e.g. custom host/port); wins over `PLAYWRIGHT_ADMIN_PATH`. |
| `E2E_ADMIN_USER` / `E2E_ADMIN_PASSWORD` | Admin credentials. If **both** are set, the second test signs in and expects a Tailwind stylesheet in `<head>`. If unset, that test is **skipped**. |

```bash
cd packages/theme-frontend-win-luna
npm run test:e2e:admin
```

With login + Tailwind assertion:

```bash
E2E_ADMIN_USER=admin E2E_ADMIN_PASSWORD='YourPass' npm run test:e2e:admin
```

### PHP: `Cannot redeclare class Genaker\ThemeTailwindLuna\Block\ResolveCss`

That fatal means PHP loaded [`Module/ThemeModule/Block/ResolveCss.php`](../Module/ThemeModule/Block/ResolveCss.php) twice in one request. There is only **one** class file in this repo; the cause is usually environment/autoload hygiene:

1. From the Magento project root: **`composer dump-autoload -o`**
2. Remove **`generated/code`**, **`generated/metadata`**, **`var/cache`**, then redeploy static if needed.
3. Ensure **one** install of the theme package: path repository should **symlink** `vendor/genaker/theme-frontend-tailwind-luna` → `packages/theme-frontend-win-luna`, not a duplicate unpacked copy alongside `packages/`.
4. Restart **PHP-FPM** or clear **OPcache** if the error persists after deploy.

### Docker / CI without Magento

`npm run test:e2e` runs Playwright only. `test:e2e:docker` sets `SKIP_E2E_MAGENTO_USER=1`.

### Warden / Docker PHP

Run the PHP script inside the PHP container with `MAGENTO_ROOT` pointing at the project root inside the container (often `/var/www/html`).
