/**
 * Resolve Magento project root (parent of app/) for reading app/etc/env.php.
 */
import fs from 'fs';
import path from 'path';

export function resolveMagentoRoot(): string {
  if (process.env.MAGENTO_ROOT) {
    return path.resolve(process.env.MAGENTO_ROOT);
  }
  // This file: e2e/lib/ → theme package → packages → project root
  return path.resolve(__dirname, '..', '..', '..', '..');
}

/**
 * Read backend.frontName from app/etc/env.php (PHP return array).
 * Falls back to env MAGENTO_BACKEND_FRONTNAME if the file is missing or unparsable.
 */
export function readBackendFrontNameFromEnvPhp(magentoRoot = resolveMagentoRoot()): string {
  const envOverride = process.env.MAGENTO_BACKEND_FRONTNAME?.trim();
  if (envOverride) {
    return envOverride.replace(/^\/+/, '');
  }

  const envPhp = path.join(magentoRoot, 'app', 'etc', 'env.php');
  if (!fs.existsSync(envPhp)) {
    throw new Error(
      `Cannot read ${envPhp}. Set MAGENTO_ROOT to your Magento root, or MAGENTO_BACKEND_FRONTNAME (e.g. backend).`,
    );
  }

  const raw = fs.readFileSync(envPhp, 'utf8');
  const single = raw.match(/'frontName'\s*=>\s*'([^']+)'/);
  const double = raw.match(/'frontName'\s*=>\s*"([^"]+)"/);
  const name = single?.[1] ?? double?.[1];
  if (!name) {
    throw new Error(`Could not parse backend.frontName in ${envPhp}`);
  }

  return name.replace(/^\/+/, '');
}

/** Path for Playwright baseURL, e.g. /backend */
export function getAdminPathFromEnvPhp(magentoRoot?: string): string {
  const front = readBackendFrontNameFromEnvPhp(magentoRoot);
  return `/${front}`;
}
