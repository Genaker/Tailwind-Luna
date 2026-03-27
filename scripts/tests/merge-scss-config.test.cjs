#!/usr/bin/env node
/**
 * Unit + integration tests for the layered scss.config.json loader (scss-config.cjs)
 * and the sort / exclude logic in merge-scss.cjs.
 *
 * Run: node scripts/tests/merge-scss-config.test.cjs
 *
 * Tests:
 *  1.  loadMergedScssConfig — no config file returns all defaults
 *  2.  loadMergedScssConfig — theme config mergeRoots resolved relative to themeRoot
 *  3.  loadMergedScssConfig — invalid JSON config is skipped (returns defaults)
 *  4.  loadMergedScssConfig — contentFiles accumulated and deduplicated across layers
 *  5.  loadMergedScssConfig — pubStaticPath last-wins (module config overrides theme)
 *  6.  loadMergedScssConfig — pubStaticPaths last-wins and clears pubStaticPath
 *  7.  loadMergedScssConfig — exclude batches carry correct cwd per config layer
 *  8.  loadMergedScssConfig — mergeRoots deduplicated across theme + module configs
 *  9.  merge-scss.cjs — numeric prefix ordering: 10- → 11- → 12- → 20-
 * 10.  merge-scss.cjs — alphabetic folder segments sort before numeric would conflict
 * 11.  merge-scss.cjs — exclude via theme scss.config.json removes file from merge
 * 12.  merge-scss.cjs — module scss.config.json mergeRoot adds extra files (tier 2)
 * 13.  merge-scss.cjs — scss.example files never included even if globbed
 * 14.  sources.cjs — scssConfigGlobs exported and non-empty
 * 15.  --list prints paths (no writes needed for assertion on stdout)
 * 16.  --verbose includes config / tier summary on stdout or stderr
 * 17.  Unknown JSON keys log a warning (stderr)
 * 18.  Module tier: lower tier number sorts before higher (tier 0 before tier 2)
 * 19.  --source-map writes _merged.css.map when sass is available
 * 20.  clampTier helper bounds values
 * 21.  watch-tailwind.cjs exists (entry for watch:tailwind)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, spawnSync } = require("child_process");

const themeRoot = path.resolve(__dirname, "..", "..");
const magentoRoot = path.resolve(themeRoot, "..", "..");
const mergedPath = path.join(themeRoot, "web", "tailwind", "_merged.scss");
const cfgPath = path.join(themeRoot, "web", "tailwind", "scss.config.json");

const { loadMergedScssConfig, clampTier } = require(path.join(themeRoot, "web", "tailwind", "scss-config.cjs"));

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  ${PASS} ${msg}`); passed++; }
  else       { console.error(`  ${FAIL} ${msg}`); failed++; }
}

function run(cmd) {
  return execSync(cmd, { cwd: themeRoot, encoding: "utf8" });
}

/**
 * Run merge-scss.cjs; tolerate exit 1 if sass is missing (the script still writes _merged.scss
 * before reaching the sass step, so path-order and content tests remain valid).
 */
function runMerge() {
  try {
    execSync("node scripts/merge-scss.cjs", { cwd: themeRoot, encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    const stderr = e.stderr || "";
    if (!stderr.includes("sass") && !stderr.includes("sass package")) throw e;
    // sass missing — _merged.scss was still written, that's fine for content tests
  }
}

/** Write scss.config.json, run callback, restore original. */
function withConfig(obj, fn) {
  const prev = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, "utf8") : null;
  fs.writeFileSync(cfgPath, JSON.stringify(obj), "utf8");
  try { fn(); } finally {
    if (prev !== null) fs.writeFileSync(cfgPath, prev, "utf8");
    else fs.unlinkSync(cfgPath);
  }
}

/** Write a file at a vendor/module path and remove it after. */
function withModuleConfig(relFromMagento, obj, fn) {
  const abs = path.join(magentoRoot, relFromMagento);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(obj), "utf8");
  try { fn(); } finally {
    try { fs.unlinkSync(abs); } catch (_) { /* ignore */ }
  }
}

// ─── 1. No config file returns all defaults ───────────────────────────────────
console.log("\n[test] 1 — no config file returns all defaults");
{
  const hadCfg = fs.existsSync(cfgPath);
  const prev = hadCfg ? fs.readFileSync(cfgPath, "utf8") : null;
  if (hadCfg) fs.unlinkSync(cfgPath);
  const result = loadMergedScssConfig(themeRoot);
  if (hadCfg && prev !== null) fs.writeFileSync(cfgPath, prev, "utf8");

  assert(Array.isArray(result.mergeRoots) && result.mergeRoots.length === 0, "mergeRoots is empty array");
  assert(Array.isArray(result.excludeBatches) && result.excludeBatches.length === 0, "excludeBatches is empty array");
  assert(Array.isArray(result.contentFiles) && result.contentFiles.length === 0, "contentFiles is empty array");
  assert(result.pubStaticPath === null, "pubStaticPath is null");
  assert(result.pubStaticPaths === null, "pubStaticPaths is null");
  assert(Array.isArray(result.tierPrefixes), "tierPrefixes is an array");
}

// ─── 2. Theme config mergeRoots resolved relative to themeRoot ───────────────
console.log("\n[test] 2 — theme config mergeRoots resolved relative to themeRoot");
{
  withConfig({ mergeRoots: ["web/tailwind/modules", "/tmp/absolute-root"] }, () => {
    const result = loadMergedScssConfig(themeRoot);
    const expectedRel = path.normalize(path.join(themeRoot, "web/tailwind/modules"));
    const expectedAbs = path.normalize("/tmp/absolute-root");
    assert(result.mergeRoots.includes(expectedRel), `relative mergeRoot resolved to ${expectedRel}`);
    assert(result.mergeRoots.includes(expectedAbs), "absolute mergeRoot kept as-is");
  });
}

// ─── 3. Invalid JSON config is skipped ───────────────────────────────────────
console.log("\n[test] 3 — invalid JSON config is skipped");
{
  const prev = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, "utf8") : null;
  fs.writeFileSync(cfgPath, "{ not valid json }", "utf8");
  const result = loadMergedScssConfig(themeRoot);
  if (prev !== null) fs.writeFileSync(cfgPath, prev, "utf8");
  else fs.unlinkSync(cfgPath);

  assert(result.mergeRoots.length === 0, "invalid JSON: mergeRoots still empty");
  assert(result.contentFiles.length === 0, "invalid JSON: contentFiles still empty");
}

// ─── 4. contentFiles accumulated and deduplicated ────────────────────────────
console.log("\n[test] 4 — contentFiles accumulated and deduplicated across layers");
{
  const moduleRel = "vendor/magento/module-scss-cfg-test/view/frontend/web/tailwind/scss.config.json";
  withConfig({ contentFiles: ["./templates/**/*.phtml", "./shared.phtml"] }, () => {
    withModuleConfig(moduleRel, { contentFiles: ["./shared.phtml", "./module-extra.phtml"] }, () => {
      const result = loadMergedScssConfig(themeRoot);
      assert(result.contentFiles.includes("./templates/**/*.phtml"), "theme contentFile present");
      assert(result.contentFiles.includes("./shared.phtml"), "shared contentFile present");
      assert(result.contentFiles.includes("./module-extra.phtml"), "module-only contentFile present");
      assert(result.contentFiles.filter((f) => f === "./shared.phtml").length === 1, "shared.phtml not duplicated");
    });
  });
}

// ─── 5. pubStaticPath last-wins (module overrides theme) ─────────────────────
console.log("\n[test] 5 — pubStaticPath: module config overrides theme");
{
  const moduleRel = "vendor/magento/module-scss-cfg-test/view/frontend/web/tailwind/scss.config.json";
  withConfig({ pubStaticPath: "pub/static/frontend/Theme/default/en_US" }, () => {
    withModuleConfig(moduleRel, { pubStaticPath: "pub/static/frontend/Module/override/en_US" }, () => {
      const result = loadMergedScssConfig(themeRoot);
      assert(result.pubStaticPath === "pub/static/frontend/Module/override/en_US", "module pubStaticPath wins");
    });
  });
}

// ─── 6. pubStaticPaths last-wins and clears pubStaticPath ────────────────────
console.log("\n[test] 6 — pubStaticPaths last-wins and clears pubStaticPath");
{
  const moduleRel = "vendor/magento/module-scss-cfg-test/view/frontend/web/tailwind/scss.config.json";
  withConfig({ pubStaticPath: "pub/static/frontend/Theme/default/en_US" }, () => {
    withModuleConfig(moduleRel, { pubStaticPaths: ["pub/static/a/en_US", "pub/static/b/en_US"] }, () => {
      const result = loadMergedScssConfig(themeRoot);
      assert(Array.isArray(result.pubStaticPaths) && result.pubStaticPaths.length === 2, "pubStaticPaths set by module");
      assert(result.pubStaticPath === null, "pubStaticPath cleared when pubStaticPaths wins");
    });
  });
}

// ─── 7. exclude batches carry correct cwd ────────────────────────────────────
console.log("\n[test] 7 — exclude batches: theme uses themeRoot, module uses its dir");
{
  const moduleRel = "vendor/magento/module-scss-cfg-test/view/frontend/web/tailwind/scss.config.json";
  const moduleDir = path.join(magentoRoot, path.dirname(moduleRel));
  withConfig({ exclude: ["web/tailwind/modules/**/*.scss"] }, () => {
    withModuleConfig(moduleRel, { exclude: ["./module-specific.scss"] }, () => {
      const result = loadMergedScssConfig(themeRoot);
      assert(result.excludeBatches.length === 2, "two exclude batches (theme + module)");
      const themeBatch = result.excludeBatches.find((b) => b.cwd === themeRoot);
      const moduleBatch = result.excludeBatches.find((b) => b.cwd === moduleDir);
      assert(themeBatch !== undefined, "theme exclude batch uses themeRoot as cwd");
      assert(themeBatch?.patterns.includes("web/tailwind/modules/**/*.scss"), "theme exclude pattern preserved");
      assert(moduleBatch !== undefined, "module exclude batch uses module dir as cwd");
      assert(moduleBatch?.patterns.includes("./module-specific.scss"), "module exclude pattern preserved");
    });
  });
}

// ─── 8. mergeRoots deduplicated across layers ────────────────────────────────
console.log("\n[test] 8 — mergeRoots deduplicated across theme and module configs");
{
  const moduleRel = "vendor/magento/module-scss-cfg-test/view/frontend/web/tailwind/scss.config.json";
  const sharedAbs = "/tmp/shared-merge-root";
  withConfig({ mergeRoots: [sharedAbs] }, () => {
    withModuleConfig(moduleRel, { mergeRoots: [sharedAbs] }, () => {
      const result = loadMergedScssConfig(themeRoot);
      const count = result.mergeRoots.filter((r) => r === path.normalize(sharedAbs)).length;
      assert(count === 1, "duplicate mergeRoot appears only once");
    });
  });
}

// ─── 9. Numeric prefix ordering: 10- → 11- → 12- → 20- ──────────────────────
console.log("\n[test] 9 — numeric prefix ordering: 10- 11- 12- 20- in merge output");
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scss-order-test-"));
  try {
    for (const name of ["20-last.scss", "10-first.scss", "12-third.scss", "11-second.scss"]) {
      fs.writeFileSync(path.join(tmpDir, name), `.${name.replace(".scss", "")} { color: red; }\n`);
    }
    withConfig({ mergeRoots: [tmpDir] }, () => {
      runMerge();
      const merged = fs.readFileSync(mergedPath, "utf8");
      const pos = (s) => merged.indexOf(s);
      assert(pos("10-first") < pos("11-second"), "10- comes before 11-");
      assert(pos("11-second") < pos("12-third"), "11- comes before 12-");
      assert(pos("12-third") < pos("20-last"), "12- comes before 20-");
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    runMerge();
  }
}

// ─── 10. Alphabetic segment sorts after numeric in same dir ──────────────────
console.log("\n[test] 10 — alphabetic filename sorts after numeric-prefixed in same dir");
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scss-alpha-test-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "10-numeric.scss"), ".n10 { color: red; }\n");
    fs.writeFileSync(path.join(tmpDir, "alpha-no-prefix.scss"), ".alpha { color: blue; }\n");
    withConfig({ mergeRoots: [tmpDir] }, () => {
      runMerge();
      const merged = fs.readFileSync(mergedPath, "utf8");
      assert(merged.indexOf("10-numeric") < merged.indexOf("alpha-no-prefix"), "numeric prefix sorts before alphabetic in same dir");
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    runMerge();
  }
}

// ─── 11. exclude via theme scss.config.json removes file from merge ───────────
console.log("\n[test] 11 — exclude pattern in theme scss.config.json removes file");
{
  const targetFile = "web/tailwind/modules/footer/footer.scss";
  assert(fs.existsSync(path.join(themeRoot, targetFile)), "footer.scss exists (precondition)");
  withConfig({ exclude: [targetFile] }, () => {
    runMerge();
    const merged = fs.readFileSync(mergedPath, "utf8");
    assert(!merged.includes("footer.scss"), "footer.scss excluded from merge via theme config");
  });
  runMerge();
}

// ─── 12. Module scss.config.json mergeRoot adds extra files at tier 2 ─────────
console.log("\n[test] 12 — module scss.config.json mergeRoot adds files to merge (tier 2)");
{
  const moduleRel = "vendor/magento/module-scss-cfg-test/view/frontend/web/tailwind/scss.config.json";
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scss-module-root-"));
  const marker = "module-cfg-extra-marker-xyz";
  try {
    fs.writeFileSync(path.join(tmpDir, "module-extra.scss"), `.${marker} { display: none; }\n`);
    withModuleConfig(moduleRel, { mergeRoots: [tmpDir] }, () => {
      runMerge();
      const merged = fs.readFileSync(mergedPath, "utf8");
      assert(merged.includes(marker), "module scss.config.json mergeRoot content present in _merged.scss");
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    runMerge();
  }
}

// ─── 13. .scss.example files never included ───────────────────────────────────
console.log("\n[test] 13 — .scss.example files excluded even from mergeRoot dirs");
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scss-example-test-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "real.scss"), ".real-file { color: green; }\n");
    fs.writeFileSync(path.join(tmpDir, "skip-me.scss.example"), ".should-not-appear { color: red; }\n");
    withConfig({ mergeRoots: [tmpDir] }, () => {
      runMerge();
      const merged = fs.readFileSync(mergedPath, "utf8");
      assert(merged.includes(".real-file"), "real.scss included");
      assert(!merged.includes(".should-not-appear"), "scss.example file not included");
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    runMerge();
  }
}

// ─── 14. sources.cjs exports scssConfigGlobs ──────────────────────────────────
console.log("\n[test] 14 — sources.cjs exports scssConfigGlobs (non-empty array)");
{
  const sources = require(path.join(themeRoot, "web", "tailwind", "sources.cjs"));
  assert(Array.isArray(sources.scssConfigGlobs) && sources.scssConfigGlobs.length > 0, "scssConfigGlobs is a non-empty array");
  const globs = sources.scssConfigGlobs;
  assert(globs.some((g) => g.includes("vendor/magento")), "scssConfigGlobs includes vendor/magento path");
  assert(globs.some((g) => g.includes("app/code")), "scssConfigGlobs includes app/code path");
  assert(globs.some((g) => g.includes("src")), "scssConfigGlobs includes src path");
}

// ─── 15. --list prints relative paths ─────────────────────────────────────────
console.log("\n[test] 15 — --list prints merged paths to stdout");
{
  const r = spawnSync("node", ["scripts/merge-scss.cjs", "--list"], { cwd: themeRoot, encoding: "utf8" });
  assert(r.status === 0, "--list exits 0");
  assert(r.stdout.includes("web/tailwind/modules/base/base.scss"), "--list output includes a known module file");
}

// ─── 16. --verbose with --list ───────────────────────────────────────────────
console.log("\n[test] 16 — --verbose --list includes tier summary");
{
  const r = spawnSync("node", ["scripts/merge-scss.cjs", "--list", "--verbose"], {
    cwd: themeRoot,
    encoding: "utf8",
  });
  assert(r.status === 0, "--list --verbose exits 0");
  const out = `${r.stdout}${r.stderr}`;
  assert(out.includes("files by tier"), "verbose output includes per-tier counts");
}

// ─── 17. Unknown JSON key warning ─────────────────────────────────────────────
console.log("\n[test] 17 — unknown scss.config.json key logs warning");
{
  withConfig({ mergeRoots: [], excludes: "typo" }, () => {
    const r = spawnSync("node", ["scripts/merge-scss.cjs", "--list"], { cwd: themeRoot, encoding: "utf8" });
    assert(r.stderr.includes("unknown key"), "stderr mentions unknown key");
  });
}

// ─── 18. Module tier sorts before higher tier (0 before 2) ────────────────────
console.log("\n[test] 18 — module tier 0 file merges before tier 2 (path lex order inverted)");
{
  const zRoot = path.join(magentoRoot, "vendor", "magento", "module-tier-zzz", "view", "frontend", "web", "tailwind");
  const aRoot = path.join(magentoRoot, "vendor", "magento", "module-tier-aaa", "view", "frontend", "web", "tailwind");
  try {
    fs.mkdirSync(zRoot, { recursive: true });
    fs.mkdirSync(aRoot, { recursive: true });
    fs.writeFileSync(
      path.join(zRoot, "scss.config.json"),
      JSON.stringify({ tier: 0 }),
      "utf8",
    );
    fs.writeFileSync(path.join(zRoot, "zzz.scss"), ".tier-zzz-marker { color: red; }\n", "utf8");
    fs.writeFileSync(
      path.join(aRoot, "scss.config.json"),
      JSON.stringify({ tier: 2 }),
      "utf8",
    );
    fs.writeFileSync(path.join(aRoot, "aaa.scss"), ".tier-aaa-marker { color: blue; }\n", "utf8");
    runMerge();
    const merged = fs.readFileSync(mergedPath, "utf8");
    const iz = merged.indexOf("zzz.scss");
    const ia = merged.indexOf("aaa.scss");
    assert(iz !== -1 && ia !== -1, "both fixture files present in merge");
    assert(iz < ia, "tier 0 module (zzz) appears before tier 2 module (aaa) despite lex path order");
  } finally {
    try {
      fs.rmSync(path.join(magentoRoot, "vendor", "magento", "module-tier-zzz"), { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
    try {
      fs.rmSync(path.join(magentoRoot, "vendor", "magento", "module-tier-aaa"), { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
    runMerge();
  }
}

// ─── 19. --source-map emits map file when sass works ─────────────────────────
console.log("\n[test] 19 — --source-map writes _merged.css.map (if sass installed)");
{
  const mapPath = path.join(themeRoot, "web", "tailwind", "_merged.css.map");
  const hadMap = fs.existsSync(mapPath);
  const r = spawnSync("node", ["scripts/merge-scss.cjs", "--source-map"], { cwd: themeRoot, encoding: "utf8" });
  if (r.status === 0) {
    assert(fs.existsSync(mapPath), "_merged.css.map exists after --source-map");
    const mergedCss = fs.readFileSync(path.join(themeRoot, "web", "tailwind", "_merged.css"), "utf8");
    assert(/\bsourceMappingURL\b.*_merged\.css\.map/.test(mergedCss), "_merged.css references source map");
    if (!hadMap) {
      try {
        fs.unlinkSync(mapPath);
      } catch (_) {
        /* ignore */
      }
    }
    runMerge();
  } else {
    assert(r.stderr.includes("sass"), "--source-map fails only when sass missing (skipped)");
  }
}

// ─── 20. clampTier ───────────────────────────────────────────────────────────
console.log("\n[test] 20 — clampTier bounds tier to 0–2");
{
  assert(clampTier(0) === 0, "clampTier(0) === 0");
  assert(clampTier(2) === 2, "clampTier(2) === 2");
  assert(clampTier(-1) === 0, "clampTier(-1) === 0");
  assert(clampTier(99) === 2, "clampTier(99) === 2");
  assert(clampTier(Number.NaN) === 2, "clampTier(NaN) defaults to 2");
}

// ─── 21. watch-tailwind.cjs present ──────────────────────────────────────────
console.log("\n[test] 21 — watch-tailwind.cjs exists");
{
  assert(fs.existsSync(path.join(themeRoot, "scripts", "watch-tailwind.cjs")), "scripts/watch-tailwind.cjs exists");
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
const total = passed + failed;
if (failed === 0) {
  console.log(`\x1b[32mAll ${total} tests passed.\x1b[0m\n`);
  process.exit(0);
} else {
  console.error(`\x1b[31m${failed}/${total} tests failed.\x1b[0m\n`);
  process.exit(1);
}
