/**
 * CLI: verify sample-data + fallback customers exist in DB (read-only).
 * Usage: npm run e2e:db:check
 */
import { findCustomerByEmail, resolveDbConfig } from './magentoDb';
import { SAMPLE_DATA_CUSTOMER } from '../sampleAccounts';

const FALLBACK_EMAIL = 'e2e_playwright@example.test';

async function main(): Promise<void> {
  const cfg = resolveDbConfig();
  if (!cfg.user || !cfg.database) {
    process.stderr.write(
      'Set E2E_MYSQL_USER + E2E_MYSQL_DATABASE (and host/password), or ensure app/etc/env.php is readable and run with PHP on PATH.\n',
    );
    process.exit(1);
  }

  const sample = await findCustomerByEmail(SAMPLE_DATA_CUSTOMER.email, cfg);
  const fallback = await findCustomerByEmail(FALLBACK_EMAIL, cfg);

  console.log('DB:', `${cfg.user}@${cfg.host}/${cfg.database}`);
  console.log('Sample-data (roni):', sample ?? 'NOT FOUND');
  console.log('Fallback E2E:', fallback ?? 'NOT FOUND');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
