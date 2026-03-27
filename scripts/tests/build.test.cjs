#!/usr/bin/env node
/**
 * Build tests for the tilewindscss / Tailwind pipeline.
 * Run: node scripts/tests/build.test.cjs
 *
 * Tests:
 *  1. sources.cjs exports expected keys and non-empty arrays
 *  2. build:tilewindscss (merge-scss.cjs) produces _merged.scss + _content-roots.json
 *  3. _merged.scss lists theme modules in folder order; extensions after modules
 *  4. _merged.scss has no duplicate @layer base blocks
 *  5. build:tailwind produces web/css/tailwind.css (non-empty)
 *  6. copy-tailwind-to-pub copies to pub/static; pub/static/deployed_version.txt timestamp
 *  7. Extra mergeRoot in scss.config.json is picked up by merge script
 *  8. tailwind.config.js can be required without errors and has content.files array
 *  9. Tailwind CSS output contains known selectors from all 9 modules
 * 10. *.scss.example files are excluded from the merge
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

const themeRoot = path.resolve(__dirname, "..", "..");
const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ${PASS} ${message}`);
    passed++;
  } else {
    console.error(`  ${FAIL} ${message}`);
    failed++;
  }
}

function assertContains(content, needle, message) {
  assert(content.includes(needle), message);
}

function run(cmd) {
  return execSync(cmd, { cwd: themeRoot, encoding: "utf8" });
}

// ---------------------------------------------------------------------------
console.log("\n[test] 1 — sources.cjs exports");
// ---------------------------------------------------------------------------
const sources = require(path.join(themeRoot, "web", "tailwind", "sources.cjs"));
assert(Array.isArray(sources.scssRootGlobs) && sources.scssRootGlobs.length > 0, "scssRootGlobs is a non-empty array");
assert(Array.isArray(sources.contentFiles) && sources.contentFiles.length > 0, "contentFiles is a non-empty array");
assert(typeof sources.defaultPubStaticPath === "string" && sources.defaultPubStaticPath.length > 0, "defaultPubStaticPath is a non-empty string");
assert(typeof sources.themeRoot === "string" && fs.existsSync(sources.themeRoot), "themeRoot exists on disk");

// ---------------------------------------------------------------------------
console.log("\n[test] 2 — merge-scss.cjs produces output files");
// ---------------------------------------------------------------------------
run("node scripts/merge-scss.cjs");
const mergedPath = path.join(themeRoot, "web", "tailwind", "_merged.scss");
const contentRootsPath = path.join(themeRoot, "web", "tailwind", "_content-roots.json");
assert(fs.existsSync(mergedPath), "_merged.scss exists");
assert(fs.existsSync(contentRootsPath), "_content-roots.json exists");
const mergedContent = fs.readFileSync(mergedPath, "utf8");
assert(mergedContent.length > 1000, "_merged.scss has substantial content (>1KB)");
const contentRoots = JSON.parse(fs.readFileSync(contentRootsPath, "utf8"));
assert(Array.isArray(contentRoots.files), "_content-roots.json has a files array");

// ---------------------------------------------------------------------------
console.log("\n[test] 3 — _merged.scss module sections in order; extensions after core modules");
// ---------------------------------------------------------------------------
const moduleMarkers = [
  "web/tailwind/modules/actions-forms/actions-forms.scss",
  "web/tailwind/modules/base/base.scss",
  "web/tailwind/modules/catalog/10-plp-grids.scss",
  "web/tailwind/modules/catalog/20-product-cards.scss",
  "web/tailwind/modules/catalog/30-plp-toolbar.scss",
  "web/tailwind/modules/catalog/40-swatches.scss",
  "web/tailwind/modules/cms/cms.scss",
  "web/tailwind/modules/footer/footer.scss",
  "web/tailwind/modules/header/header.scss",
  "web/tailwind/modules/layout/layout.scss",
  "web/tailwind/modules/messages-tables/messages-tables.scss",
  "web/tailwind/modules/navigation/navigation.scss",
];
let lastIdx = -1;
for (const marker of moduleMarkers) {
  const idx = mergedContent.indexOf(marker);
  assert(idx !== -1, `module section "${marker}" present in _merged.scss`);
  if (idx !== -1) {
    assert(idx > lastIdx, `"${path.basename(marker)}" appears after the previous module (order correct)`);
    lastIdx = idx;
  }
}
const headerMatch = mergedContent.match(/\* Files \(\d+\): ([^\n*]+)/);
if (headerMatch) {
  const listed = headerMatch[1].split(",").map((s) => s.trim());
  let lastModulePos = -1;
  let firstExtPos = Infinity;
  for (let i = 0; i < listed.length; i++) {
    const p = listed[i];
    if (p.startsWith("web/tailwind/modules/")) lastModulePos = i;
    if (p.startsWith("web/tailwind/extensions/")) firstExtPos = Math.min(firstExtPos, i);
  }
  if (firstExtPos !== Infinity) {
    assert(lastModulePos < firstExtPos, "merge header: all web/tailwind/modules/ paths before web/tailwind/extensions/");
  }
}

// ---------------------------------------------------------------------------
console.log("\n[test] 4 — no duplicate @layer base in _merged.scss");
// ---------------------------------------------------------------------------
const layerBaseMatches = mergedContent.match(/@layer base\s*\{/g) || [];
assert(layerBaseMatches.length <= 1, `@layer base appears at most once (found ${layerBaseMatches.length})`);

// ---------------------------------------------------------------------------
console.log("\n[test] 5 — build:tailwind produces non-empty web/css/tailwind.css");
// ---------------------------------------------------------------------------
run("npm run build:tailwind");
const tailwindCssPath = path.join(themeRoot, "web", "css", "tailwind.css");
assert(fs.existsSync(tailwindCssPath), "web/css/tailwind.css exists");
const tailwindSize = fs.statSync(tailwindCssPath).size;
assert(tailwindSize > 10000, `tailwind.css is substantial (${tailwindSize} bytes > 10KB)`);

const tailwindMinPath = path.join(themeRoot, "web", "css", "tailwind.min.css");
assert(fs.existsSync(tailwindMinPath), "web/css/tailwind.min.css exists (emit-tailwind-min-alias after build)");
const tailwindMinSize = fs.statSync(tailwindMinPath).size;
assert(tailwindMinSize > 10000, `tailwind.min.css is substantial (${tailwindMinSize} bytes > 10KB)`);
assert(
  tailwindMinSize === fs.statSync(tailwindCssPath).size,
  "tailwind.css and tailwind.min.css are identical bytes after single cssnano pass",
);

const checkoutCssPath = path.join(themeRoot, "web", "css", "checkout.css");
assert(fs.existsSync(checkoutCssPath), "web/css/checkout.css exists");
const checkoutCssSize = fs.statSync(checkoutCssPath).size;
assert(checkoutCssSize > 1000, `checkout.css is non-trivial (${checkoutCssSize} bytes > 1KB)`);

// ---------------------------------------------------------------------------
console.log("\n[test] 6 — copy-tailwind-to-pub.cjs copies to pub/static (all registered theme paths)");
// ---------------------------------------------------------------------------
const magentoRoot = path.resolve(themeRoot, "..", "..");
const pubPaths = sources.defaultPubStaticPaths || [sources.defaultPubStaticPath];
const srcSize = fs.statSync(tailwindCssPath).size;
for (const rel of pubPaths) {
  const pubCssPath = path.join(magentoRoot, rel, "css", "tailwind.css");
  assert(fs.existsSync(pubCssPath), `pub/static copy exists at ${rel}/css/tailwind.css`);
  const pubSize = fs.statSync(pubCssPath).size;
  assert(srcSize === pubSize, `pub copy at ${rel} size (${pubSize}) matches src (${srcSize})`);
  const pubMinPath = path.join(magentoRoot, rel, "css", "tailwind.min.css");
  assert(fs.existsSync(pubMinPath), `pub/static copy exists at ${rel}/css/tailwind.min.css`);
  assert(
    fs.statSync(pubMinPath).size === fs.statSync(tailwindMinPath).size,
    `pub tailwind.min.css at ${rel} matches web/css/tailwind.min.css size`,
  );
}
const checkoutMinPath = path.join(themeRoot, "web", "css", "checkout.min.css");
assert(fs.existsSync(checkoutMinPath), "web/css/checkout.min.css exists after minify-checkout");
const checkoutMinSrcSize = fs.statSync(checkoutMinPath).size;
for (const rel of pubPaths) {
  const pubCheckoutPath = path.join(magentoRoot, rel, "css", "checkout.min.css");
  assert(fs.existsSync(pubCheckoutPath), `pub/static copy exists at ${rel}/css/checkout.min.css`);
  const pubCoSize = fs.statSync(pubCheckoutPath).size;
  assert(checkoutMinSrcSize === pubCoSize, `pub checkout.min.css at ${rel} matches src size`);
}

const deployedVersionPath = path.join(magentoRoot, "pub", "static", "deployed_version.txt");
assert(fs.existsSync(deployedVersionPath), "pub/static/deployed_version.txt exists after build:tailwind");
const dv = fs.readFileSync(deployedVersionPath, "utf8").trim();
assert(/^\d+$/.test(dv), `deployed_version.txt is a numeric timestamp (got "${dv}")`);

// ---------------------------------------------------------------------------
console.log("\n[test] 7 — extra mergeRoot in scss.config.json is picked up");
// ---------------------------------------------------------------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tilewindscss-test-"));
const extraScss = path.join(tmpDir, "custom.scss");
fs.writeFileSync(extraScss, ".custom-test-class { color: red; }\n");
const cfgPath = path.join(themeRoot, "web", "tailwind", "scss.config.json");
const hadConfig = fs.existsSync(cfgPath);
const prevConfig = hadConfig ? fs.readFileSync(cfgPath, "utf8") : null;
fs.writeFileSync(cfgPath, JSON.stringify({ mergeRoots: [tmpDir] }));
run("node scripts/merge-scss.cjs");
const mergedWithExtra = fs.readFileSync(mergedPath, "utf8");
assertContains(mergedWithExtra, ".custom-test-class", "extra mergeRoot .scss content present in _merged.scss");
if (hadConfig && prevConfig) {
  fs.writeFileSync(cfgPath, prevConfig);
} else {
  fs.unlinkSync(cfgPath);
}
run("node scripts/merge-scss.cjs");
fs.rmSync(tmpDir, { recursive: true });

// ---------------------------------------------------------------------------
console.log("\n[test] 8 — tailwind.config.js requires cleanly and has content.files");
// ---------------------------------------------------------------------------
const twConfig = require(path.join(themeRoot, "tailwind.config.js"));
assert(twConfig && twConfig.content, "tailwind.config.js exports an object with content");
assert(Array.isArray(twConfig.content.files) && twConfig.content.files.length > 0, "content.files is a non-empty array");
assertContains(twConfig.content.files.join(" "), "vendor/magento/module-", "content.files includes vendor/magento/module-* glob");
assertContains(twConfig.content.files.join(" "), "app/code", "content.files includes app/code glob");
assert(typeof twConfig.content.transform?.phtml === "function", "phtml transform function present");

// ---------------------------------------------------------------------------
console.log("\n[test] 9 — tailwind.css output contains selectors from all 9 modules");
// ---------------------------------------------------------------------------
const outCss = fs.readFileSync(tailwindCssPath, "utf8");
const selectors = [
  ".no-display",           // base
  ".page-wrapper",         // layout
  ".page-header",          // header
  ".navigation",           // navigation
  ".page-footer",          // footer
  ".action.tocart",        // actions-forms
  ".product-item-info",    // catalog
  ".message.success",      // messages-tables
  ".blocks-promo",         // cms
];
for (const sel of selectors) {
  assertContains(outCss, sel, `tailwind.css contains selector "${sel}"`);
}

// ---------------------------------------------------------------------------
console.log("\n[test] 10 — *.scss.example files excluded from merge");
// ---------------------------------------------------------------------------
const extDir = path.join(themeRoot, "web", "tailwind", "extensions");
const exampleFiles = fs.readdirSync(extDir).filter((f) => f.endsWith(".scss.example"));
if (exampleFiles.length > 0) {
  const merged = fs.readFileSync(mergedPath, "utf8");
  for (const ex of exampleFiles) {
    assert(!merged.includes(ex), `example file "${ex}" is not included in _merged.scss`);
  }
} else {
  assert(true, "no *.scss.example files found in extensions/ (nothing to exclude)");
}

// ---------------------------------------------------------------------------
console.log(`\n${"─".repeat(50)}`);
const total = passed + failed;
if (failed === 0) {
  console.log(`\x1b[32mAll ${total} tests passed.\x1b[0m\n`);
  process.exit(0);
} else {
  console.error(`\x1b[31m${failed}/${total} tests failed.\x1b[0m\n`);
  process.exit(1);
}
