#!/usr/bin/env node
/** Run ensure-e2e-user.php (sample-data user if present, else create fallback). */
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const scriptsDir = __dirname;
const magentoRoot = process.env.MAGENTO_ROOT || path.resolve(scriptsDir, "..", "..", "..", "..");
const phpBin = process.env.PHP_BIN || "php";
const env = { ...process.env, MAGENTO_ROOT: magentoRoot };
if (!process.env.E2E_USER_EMAIL) {
  delete env.E2E_USER_EMAIL;
}
if (!process.env.E2E_USER_PASSWORD) {
  delete env.E2E_USER_PASSWORD;
}

const r = spawnSync(phpBin, [path.join(scriptsDir, "ensure-e2e-user.php")], {
  stdio: ["inherit", "pipe", "inherit"],
  encoding: "utf8",
  env,
});
if (r.status !== 0) {
  process.exit(r.status ?? 1);
}
try {
  const j = JSON.parse((r.stdout || "").trim());
  process.stdout.write(JSON.stringify(j, null, 2) + "\n");
} catch {
  process.stderr.write("[e2e] ensure-e2e-user.php did not return valid JSON on stdout.\n");
  process.exit(1);
}
process.exit(0);
