<?php
/**
 * Print DB connection JSON for Node (Magento app/etc/env.php).
 * Usage: MAGENTO_ROOT=/path/to/magento php e2e/db/read-env-db.php
 */
declare(strict_types=1);

$magentoRoot = getenv('MAGENTO_ROOT') ?: dirname(__DIR__, 4);
$envPhp = $magentoRoot . '/app/etc/env.php';
if (!is_file($envPhp)) {
    fwrite(STDERR, "[read-env-db] Missing {$envPhp}\n");
    exit(1);
}

$c = require $envPhp;
$d = $c['db']['connection']['default'] ?? [];
$out = [
    'host' => $d['host'] ?? '127.0.0.1',
    'port' => isset($d['port']) ? (int) $d['port'] : 3306,
    'user' => $d['username'] ?? '',
    'password' => $d['password'] ?? '',
    'database' => $d['dbname'] ?? '',
];
echo json_encode($out, JSON_UNESCAPED_SLASHES);
