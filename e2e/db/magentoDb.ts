/**
 * Minimal MySQL helper for E2E / tooling (read-only by default).
 * Prefers env vars; can load host/db/user/pass from Magento app/etc/env.php via PHP.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';

export type MagentoDbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

/** Connection from E2E_MYSQL_* (or MYSQL_* fallback). */
export function getDbConfigFromEnv(): MagentoDbConfig {
  return {
    host: process.env.E2E_MYSQL_HOST || process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.E2E_MYSQL_PORT || process.env.MYSQL_PORT || 3306),
    user: process.env.E2E_MYSQL_USER || process.env.MYSQL_USER || '',
    password: process.env.E2E_MYSQL_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.E2E_MYSQL_DATABASE || process.env.MYSQL_DATABASE || '',
  };
}

/**
 * Load `db.connection.default` from Magento env.php using bundled PHP script.
 * Requires `php` on PATH and readable app/etc/env.php.
 */
export function loadDbConfigFromMagentoEnvPhp(magentoRoot: string): MagentoDbConfig {
  const script = path.join(__dirname, 'read-env-db.php');
  if (!fs.existsSync(script)) {
    throw new Error(`Missing ${script}`);
  }
  const envPhp = path.join(magentoRoot, 'app', 'etc', 'env.php');
  if (!fs.existsSync(envPhp)) {
    throw new Error(`Magento env.php not found: ${envPhp}`);
  }
  const raw = execFileSync(process.env.PHP_BIN || 'php', [script], {
    encoding: 'utf8',
    env: { ...process.env, MAGENTO_ROOT: magentoRoot },
  });
  const j = JSON.parse(raw.trim()) as MagentoDbConfig;
  return {
    host: j.host || '127.0.0.1',
    port: j.port || 3306,
    user: j.user || '',
    password: j.password || '',
    database: j.database || '',
  };
}

/** Resolve config: explicit env DB vars → else env.php when magentoRoot set. */
export function resolveDbConfig(magentoRoot?: string): MagentoDbConfig {
  const fromEnv = getDbConfigFromEnv();
  if (fromEnv.user && fromEnv.database) {
    return fromEnv;
  }
  const root = magentoRoot || process.env.MAGENTO_ROOT || defaultMagentoRoot();
  return loadDbConfigFromMagentoEnvPhp(root);
}

function defaultMagentoRoot(): string {
  // e2e/db → theme package → packages → project root (four levels up from this file)
  return path.resolve(__dirname, '..', '..', '..', '..');
}

export async function createConnection(config: MagentoDbConfig) {
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });
}

export async function query<T extends RowDataPacket[]>(
  sql: string,
  params?: unknown[],
  config?: MagentoDbConfig,
): Promise<T> {
  const cfg = config ?? resolveDbConfig();
  const conn = await createConnection(cfg);
  try {
    const [rows] = await conn.query(sql, params);
    return rows as T;
  } finally {
    await conn.end();
  }
}

/** Returns row from customer_entity or null. */
export async function findCustomerByEmail(
  email: string,
  config?: MagentoDbConfig,
): Promise<{ entity_id: number; email: string; website_id: number } | null> {
  const rows = await query<RowDataPacket[]>(
    'SELECT entity_id, email, website_id FROM customer_entity WHERE email = ? LIMIT 1',
    [email],
    config,
  );
  const r = rows[0];
  if (!r) {
    return null;
  }
  return {
    entity_id: Number(r.entity_id),
    email: String(r.email),
    website_id: Number(r.website_id),
  };
}
