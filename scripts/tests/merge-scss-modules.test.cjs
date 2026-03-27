#!/usr/bin/env node
/**
 * Verifies merge-scss.cjs picks up SCSS from Magento-style module paths (vendor + src).
 * Convention: view/frontend/web/tailwind/ (all .scss files; see sources.cjs scssRootGlobs).
 *
 * Run: node scripts/tests/merge-scss-modules.test.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const themeRoot = path.resolve(__dirname, "..", "..");
const magentoRoot = path.resolve(themeRoot, "..", "..");

const vendorFixtureRoot = path.join(
  magentoRoot,
  "vendor",
  "magento",
  "module-merge-test",
  "view",
  "frontend",
  "web",
  "tailwind",
);
const srcFixtureRoot = path.join(
  magentoRoot,
  "src",
  "merge-test-module",
  "view",
  "frontend",
  "web",
  "tailwind",
);

const VENDOR_MARKER = "merge-test-scss:vendor-module-merge-test";
const SRC_MARKER = "merge-test-scss:src-merge-test-module";

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";

function cleanup() {
  for (const dir of [
    path.join(magentoRoot, "vendor", "magento", "module-merge-test"),
    path.join(magentoRoot, "src", "merge-test-module"),
  ]) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
  }
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`  ${FAIL} ${msg}`);
    process.exit(1);
  }
  console.log(`  ${PASS} ${msg}`);
}

cleanup();

fs.mkdirSync(vendorFixtureRoot, { recursive: true });
fs.writeFileSync(
  path.join(vendorFixtureRoot, "_merge_test_vendor.scss"),
  `/* ${VENDOR_MARKER} */\n.test-merge-vendor { display: none; }\n`,
  "utf8",
);

fs.mkdirSync(srcFixtureRoot, { recursive: true });
fs.writeFileSync(
  path.join(srcFixtureRoot, "_merge_test_src.scss"),
  `/* ${SRC_MARKER} */\n.test-merge-src { display: none; }\n`,
  "utf8",
);

try {
  console.log("\n[test] merge-scss includes vendor/magento + src module tailwind/*.scss\n");
  try {
    execSync("node scripts/merge-scss.cjs", { cwd: themeRoot, encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    const stderr = String(e.stderr || "");
    if (!stderr.includes("sass") && !stderr.includes("sass package")) throw e;
  }

  const mergedPath = path.join(themeRoot, "web", "tailwind", "_merged.scss");
  assert(fs.existsSync(mergedPath), "_merged.scss exists after merge-scss.cjs");
  const merged = fs.readFileSync(mergedPath, "utf8");

  assert(merged.includes(VENDOR_MARKER), "_merged.scss contains vendor/magento/module-merge-test SCSS");
  assert(merged.includes(SRC_MARKER), "_merged.scss contains src/**/view/.../tailwind SCSS");
  assert(
    merged.includes("vendor/magento/module-merge-test/view/frontend/web/tailwind/_merge_test_vendor.scss"),
    "_merged.scss header lists vendor fixture path",
  );
  assert(
    merged.includes("src/merge-test-module/view/frontend/web/tailwind/_merge_test_src.scss"),
    "_merged.scss header lists src fixture path",
  );

  console.log(`\n\x1b[32mAll merge-scss module path tests passed.\x1b[0m\n`);
} finally {
  cleanup();
}
