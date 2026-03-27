#!/usr/bin/env node
/**
 * Pre-test: ensure-e2e-user.php (env → sample-data roni_cost → create fallback), then Playwright.
 * Optional post-test delete if E2E_DELETE_USER=1 (never deletes sample-data user).
 *
 * Env:
 *   SKIP_E2E_MAGENTO_USER=1 — skip PHP (set E2E_USER_* yourself; optional defaults: roni sample)
 *   MAGENTO_ROOT, PHP_BIN
 *   E2E_USER_EMAIL + E2E_USER_PASSWORD — force credentials (skip auto-resolution)
 *   E2E_DELETE_USER=1 — delete E2E user after tests (skipped for sample_data source)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const scriptsDir = __dirname;
const themeRoot = path.join(scriptsDir, "..", "..");
const magentoRoot =
  process.env.MAGENTO_ROOT || path.resolve(scriptsDir, "..", "..", "..", "..");
const phpBin = process.env.PHP_BIN || "php";

const ensureScript = path.join(scriptsDir, "ensure-e2e-user.php");
const deleteScript = path.join(scriptsDir, "delete-e2e-customer.php");

function runEnsureAndApplyEnv() {
  const env = { ...process.env, MAGENTO_ROOT: magentoRoot };
  if (!process.env.E2E_USER_EMAIL) {
    delete env.E2E_USER_EMAIL;
  }
  if (!process.env.E2E_USER_PASSWORD) {
    delete env.E2E_USER_PASSWORD;
  }

  const r = spawnSync(phpBin, [ensureScript], {
    env,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  if (r.status !== 0) {
    return r.status ?? 1;
  }
  let j;
  try {
    j = JSON.parse((r.stdout || "").trim());
  } catch {
    process.stderr.write("[e2e] ensure-e2e-user.php did not return valid JSON on stdout.\n");
    return 1;
  }
  process.env.E2E_USER_EMAIL = j.email;
  process.env.E2E_USER_PASSWORD = j.password;
  process.env.E2E_USER_SOURCE = j.source;
  return 0;
}

function runPhpDelete() {
  return spawnSync(phpBin, [deleteScript], {
    env: { ...process.env, MAGENTO_ROOT: magentoRoot },
    stdio: "inherit",
    encoding: "utf8",
  }).status ?? 1;
}

function runPlaywright() {
  let playwrightCli;
  try {
    playwrightCli = require.resolve("@playwright/test/cli", { paths: [themeRoot] });
  } catch {
    process.stderr.write("[e2e] Run npm install in the theme directory first.\n");
    return 1;
  }
  const extra = process.argv.slice(2);
  const r = spawnSync(process.execPath, [playwrightCli, "test", "--config=playwright.config.ts", ...extra], {
    cwd: themeRoot,
    env: process.env,
    stdio: "inherit",
  });
  return r.status ?? 1;
}

let exitCode = 0;

if (process.env.SKIP_E2E_MAGENTO_USER === "1") {
  process.stderr.write("[e2e] SKIP_E2E_MAGENTO_USER=1 — skipping ensure-e2e-user.php\n");
  if (!process.env.E2E_USER_EMAIL) {
    process.env.E2E_USER_EMAIL = "roni_cost@example.com";
    process.env.E2E_USER_PASSWORD = "roni_cost3@example.com";
    process.stderr.write("[e2e] Defaulting E2E_USER_EMAIL to sample-data demo (override if needed).\n");
  }
} else {
  if (!fs.existsSync(path.join(magentoRoot, "app", "bootstrap.php"))) {
    process.stderr.write(
      `[e2e] Magento root not found: ${magentoRoot}\n` +
        "Set MAGENTO_ROOT or run from a checkout where theme lives in packages/theme-frontend-win-luna.\n",
    );
    process.exit(1);
  }
  exitCode = runEnsureAndApplyEnv();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

exitCode = runPlaywright();

if (
  process.env.SKIP_E2E_MAGENTO_USER !== "1" &&
  process.env.E2E_DELETE_USER === "1" &&
  process.env.E2E_USER_SOURCE !== "sample_data"
) {
  const del = runPhpDelete();
  if (del !== 0 && exitCode === 0) {
    exitCode = del;
  }
} else if (process.env.E2E_DELETE_USER === "1" && process.env.E2E_USER_SOURCE === "sample_data") {
  process.stderr.write("[e2e] Skipping delete (sample-data demo user).\n");
}

process.exit(exitCode);
