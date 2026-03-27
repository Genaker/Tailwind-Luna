import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/no-js-errors';

/** Strong enough for default Magento password rules (length + complexity). */
const DEFAULT_PASSWORD = 'TestPass123!';

function uniqueEmail(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.test`;
}

/** Required Luma customer routes (must return 200 for a normal store). */
const ACCOUNT_PAGES_REQUIRED: { path: string; name: string }[] = [
  { path: '/customer/account/', name: 'Dashboard' },
  { path: '/customer/account/edit/', name: 'Account information' },
  { path: '/customer/address/', name: 'Address book' },
  { path: '/sales/order/history/', name: 'My orders' },
];

/** Optional — skipped when HTTP not OK or noroute (wishlist / newsletter disabled). */
const ACCOUNT_PAGES_OPTIONAL: { path: string; name: string }[] = [
  { path: '/newsletter/manage/', name: 'Newsletter subscriptions' },
  { path: '/wishlist/', name: 'Wishlist' },
];

async function assertNoNoroute(page: Page): Promise<void> {
  await expect(page.locator('body.cms-noroute-index')).toHaveCount(0);
}

async function assertNoFatalPage(page: Page): Promise<void> {
  await expect(page.locator('body')).toBeVisible();
  await assertNoNoroute(page);
}

async function fillCreateAccountForm(page: Page, email: string, password: string): Promise<void> {
  await page.locator('input[name="firstname"], #firstname').first().fill('E2E');
  await page.locator('input[name="lastname"], #lastname').first().fill('Playwright');
  await page.locator('input[name="email"], #email_address').first().fill(email);
  const pwd = page.locator('input[name="password"], #password').first();
  await expect(pwd).toBeVisible({ timeout: 15_000 });
  await pwd.fill(password);
  const confirm = page.locator('input[name="password_confirmation"], #password-confirmation').first();
  await expect(confirm).toBeVisible({ timeout: 10_000 });
  await confirm.fill(password);
  await page.locator('form#form-validate button.action.submit.primary, button[title="Create an Account"]').first().click();
}

/** Returns true if login succeeded (user existed and password matched). */
async function tryLogin(page: Page, email: string, password: string): Promise<boolean> {
  await page.goto('/customer/account/login/', { waitUntil: 'domcontentloaded' });
  const emailField = page.locator('#email, input[name="login[username]"]').first();
  if (!(await emailField.isVisible().catch(() => false))) {
    return false;
  }
  await emailField.fill(email);
  await page.locator('#pass, input[name="login[password]"]').first().fill(password);
  await page
    .locator('form[action*="loginPost"] button[type="submit"], form#customer-login-form button, #send2')
    .first()
    .click();
  try {
    await page.waitForURL(/\/customer\/account\//, { timeout: 30_000 });
    await expect(page.locator('body.customer-account-index, body[class*="customer-account"]')).first().toBeVisible({
      timeout: 15_000,
    });
    return true;
  } catch {
    return false;
  }
}

async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  const ok = await tryLogin(page, email, password);
  expect(ok, 'Login failed — check E2E_USER_EMAIL / E2E_USER_PASSWORD').toBe(true);
}

async function visitAccountPages(page: Page): Promise<void> {
  for (const { path, name } of ACCOUNT_PAGES_REQUIRED) {
    await test.step(`Open ${name} (${path})`, async () => {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(res?.ok(), `${path} HTTP ${res?.status()}`).toBeTruthy();
      await assertNoFatalPage(page);
      await expect(page.locator('main, .column.main, #maincontent').first()).toBeVisible({
        timeout: 25_000,
      });
    });
  }
  for (const { path, name } of ACCOUNT_PAGES_OPTIONAL) {
    await test.step(`Open ${name} (${path}) [optional]`, async () => {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (!res?.ok()) {
        return;
      }
      if ((await page.locator('body.cms-noroute-index').count()) > 0) {
        return;
      }
      await expect(page.locator('main, .column.main, #maincontent').first()).toBeVisible({
        timeout: 25_000,
      });
    });
  }
}

test.describe('Customer account', () => {
  test.describe.configure({ mode: 'serial' });

  test('create user → browse account pages → logout → login → browse account pages', async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL ?? uniqueEmail();
    const password = process.env.E2E_USER_PASSWORD ?? DEFAULT_PASSWORD;
    /** Both set → login only, never register. */
    const loginOnly = !!(process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);
    /** Only email set → try login first; if user exists, skip create. */
    const emailOnlyTryLoginFirst = !!process.env.E2E_USER_EMAIL && !process.env.E2E_USER_PASSWORD;

    await test.step('Home', async () => {
      const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(res?.ok(), `home HTTP ${res?.status()}`).toBeTruthy();
    });

    if (loginOnly) {
      await test.step('Login (user exists — E2E_USER_EMAIL + E2E_USER_PASSWORD, no registration)', async () => {
        await submitLogin(page, email, password);
      });
    } else if (emailOnlyTryLoginFirst) {
      await test.step('Login if user already exists (same email + default password)', async () => {
        const loggedIn = await tryLogin(page, email, password);
        if (loggedIn) {
          return;
        }
        await test.step('Create account (first run)', async () => {
          const res = await page.goto('/customer/account/create/', { waitUntil: 'domcontentloaded' });
          expect(res?.ok(), `create account HTTP ${res?.status()}`).toBeTruthy();

          if (await page.locator('.g-recaptcha, #recaptcha, [data-captcha]').first().isVisible().catch(() => false)) {
            test.skip(true, 'Registration CAPTCHA is enabled; set E2E_USER_EMAIL + E2E_USER_PASSWORD or disable CAPTCHA for testing.');
          }

          await fillCreateAccountForm(page, email, password);
          await page.waitForURL(/customer\/account\//, { timeout: 60_000 });
          await expect(page.locator('body.customer-account-index')).toBeVisible({ timeout: 30_000 });
        });
      });
    } else {
      await test.step('Create account (anonymous email)', async () => {
        const res = await page.goto('/customer/account/create/', { waitUntil: 'domcontentloaded' });
        expect(res?.ok(), `create account HTTP ${res?.status()}`).toBeTruthy();

        if (await page.locator('.g-recaptcha, #recaptcha, [data-captcha]').first().isVisible().catch(() => false)) {
          test.skip(true, 'Registration CAPTCHA is enabled; set E2E_USER_EMAIL + E2E_USER_PASSWORD or disable CAPTCHA for testing.');
        }

        await fillCreateAccountForm(page, email, password);
        await page.waitForURL(/customer\/account\//, { timeout: 60_000 });
        await expect(page.locator('body.customer-account-index')).toBeVisible({ timeout: 30_000 });
      });
    }

    await test.step('Account pages (session)', async () => {
      await visitAccountPages(page);
    });

    await test.step('Logout', async () => {
      const signOut = page.getByRole('link', { name: /sign out/i }).first();
      if (await signOut.isVisible().catch(() => false)) {
        await signOut.click();
      } else {
        await page.goto('/customer/account/logout/', { waitUntil: 'domcontentloaded' });
      }
      await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible({ timeout: 40_000 });
    });

    await test.step('Login again', async () => {
      await submitLogin(page, email, password);
    });

    await test.step('Account pages (after re-login)', async () => {
      await visitAccountPages(page);
    });
  });
});
