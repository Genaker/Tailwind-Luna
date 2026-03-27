#!/usr/bin/env node
/**
 * Merge all *.scss from configured roots into web/tailwind/_merged.scss (deterministic order).
 * Compiles that bundle with Sass into web/tailwind/_merged.css for Tailwind (postcss-import).
 *
 * Flags:
 *   --list, -l       Print merged paths in order (no file writes).
 *   --verbose, -v    Log each scss.config.json layer and per-tier file counts.
 *   --source-map     Emit _merged.css.map and sourceMappingURL in _merged.css.
 *   --minify, -m     Emit compressed CSS (smaller _merged.css).
 *   --help, -h       Show usage.
 *
 * Config (layered): web/tailwind/scss.config.json (theme), then each module
 * …/view/frontend/web/tailwind/scss.config.json — see web/tailwind/scss-config.cjs
 *
 * Order: tier (see tierForFile), then path segments. Numeric basename prefixes (10-name.scss)
 * sort numerically within the same tier.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { globSync } = require("glob");
const { loadMergedScssConfig } = require(path.join(__dirname, "..", "web", "tailwind", "scss-config.cjs"));

const themeRoot = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const list = argv.includes("--list") || argv.includes("-l");
const verbose = argv.includes("--verbose") || argv.includes("-v");
const sourceMap = argv.includes("--source-map");
const minify = argv.includes("--minify") || argv.includes("-m");

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`Usage: node scripts/merge-scss.cjs [options]

Writes web/tailwind/_merged.scss (concatenated sources) and web/tailwind/_merged.css (Sass output).

Options:
  --list, -l       Print merged file paths in order (no writes).
  --verbose, -v    Log each scss.config.json layer and per-tier file counts.
  --source-map     Emit web/tailwind/_merged.css.map (DevTools map to original .scss files).
  --minify, -m     Compressed CSS for _merged.css (default: expanded).
  --help, -h       Show this help.
`);
  process.exit(0);
}

const outMerged = path.join(themeRoot, "web", "tailwind", "_merged.scss");
const outMergedCss = path.join(themeRoot, "web", "tailwind", "_merged.css");
const outMergedCssMap = path.join(themeRoot, "web", "tailwind", "_merged.css.map");
const outContentRoots = path.join(themeRoot, "web", "tailwind", "_content-roots.json");
const { scssRootGlobs, themeRoot: sourcesThemeRoot } = require(path.join(themeRoot, "web", "tailwind", "sources.cjs"));

if (sourcesThemeRoot !== themeRoot) {
  throw new Error("sources.cjs themeRoot mismatch");
}

/** Basename starts with digits then - or _ (e.g. 10-plp-grids.scss, 20_foo.scss). */
const NUM_PREFIX = /^(\d+)([-_])(.*)$/;

function parseSegment(seg) {
  const m = seg.match(NUM_PREFIX);
  if (m) {
    return { kind: "n", n: parseInt(m[1], 10), tail: m[3] };
  }
  return { kind: "s", s: seg };
}

function compareSegment(a, b) {
  const pa = parseSegment(a);
  const pb = parseSegment(b);
  if (pa.kind === "n" && pb.kind === "n") {
    if (pa.n !== pb.n) return pa.n - pb.n;
    return pa.tail.localeCompare(pb.tail);
  }
  if (pa.kind === "n" && pb.kind === "s") return -1;
  if (pa.kind === "s" && pb.kind === "n") return 1;
  return pa.s.localeCompare(pb.s);
}

function compareRelPaths(relA, relB) {
  const sa = relA.split("/");
  const sb = relB.split("/");
  const len = Math.max(sa.length, sb.length);
  for (let i = 0; i < len; i++) {
    const a = sa[i];
    const b = sb[i];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    const c = compareSegment(a, b);
    if (c !== 0) return c;
  }
  return 0;
}

function tierForFile(abs, rel, cfg) {
  if (rel === "web/tailwind/modules" || rel.startsWith("web/tailwind/modules/")) return 0;
  if (rel === "web/tailwind/extensions" || rel.startsWith("web/tailwind/extensions/")) return 1;
  const norm = path.normalize(abs);
  let bestPrefix = "";
  let bestTier = 2;
  for (const { prefix, tier } of cfg.tierPrefixes || []) {
    const p = path.normalize(prefix);
    if (norm === p || norm.startsWith(p + path.sep)) {
      if (p.length > bestPrefix.length) {
        bestPrefix = p;
        bestTier = tier;
      }
    }
  }
  return bestTier;
}

function applyExcludes(fileSet, excludeBatches) {
  for (const { cwd, patterns } of excludeBatches) {
    for (const raw of patterns) {
      if (!raw || typeof raw !== "string") continue;
      const pattern = raw.replace(/\\/g, "/");
      const matches = globSync(pattern, {
        cwd,
        absolute: true,
        nodir: true,
      });
      for (const f of matches) {
        if (f.endsWith(".scss")) fileSet.delete(f);
      }
    }
  }
}

function relPosix(abs) {
  return path.relative(themeRoot, abs).replace(/\\/g, "/");
}

function collectScssFiles(cfg) {
  const globs = [...scssRootGlobs];
  for (const r of cfg.mergeRoots || []) {
    const abs = r;
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      globs.push(path.join(abs, "**/*.scss").replace(/\\/g, "/"));
    } else {
      globs.push(path.relative(themeRoot, abs).replace(/\\/g, "/"));
    }
  }

  const files = new Set();
  for (const pattern of globs) {
    const matches = globSync(pattern, {
      cwd: themeRoot,
      absolute: true,
      nodir: true,
      ignore: ["**/*.scss.example", "**/node_modules/**"],
    });
    for (const f of matches) {
      if (f.endsWith(".scss") && !f.endsWith(".scss.example")) {
        files.add(f);
      }
    }
  }

  applyExcludes(files, cfg.excludeBatches);

  return [...files].sort((a, b) => {
    const ra = relPosix(a);
    const rb = relPosix(b);
    const ta = tierForFile(a, ra, cfg);
    const tb = tierForFile(b, rb, cfg);
    if (ta !== tb) return ta - tb;
    return compareRelPaths(ra, rb);
  });
}

function printTierCounts(files, cfg) {
  const counts = { 0: 0, 1: 0, 2: 0 };
  for (const f of files) {
    const t = tierForFile(f, relPosix(f), cfg);
    counts[t]++;
  }
  console.log(`[merge-scss] files by tier: 0=${counts[0]} 1=${counts[1]} 2=${counts[2]}`);
}

const cfg = loadMergedScssConfig(themeRoot, { verbose });
const files = collectScssFiles(cfg);

if (list) {
  if (verbose) {
    printTierCounts(files, cfg);
  }
  for (const f of files) {
    console.log(relPosix(f));
  }
  process.exit(0);
}

if (verbose) {
  printTierCounts(files, cfg);
}

const header = `/*
 * AUTO-GENERATED — do not edit by hand.
 * Source: scripts/merge-scss.cjs
 * Files (${files.length}): ${files.map((f) => path.relative(themeRoot, f)).join(", ") || "(none)"}
 */

`;

let body = "";
for (const f of files) {
  const rel = path.relative(themeRoot, f);
  body += `\n/* ---- ${rel} ---- */\n`;
  body += fs.readFileSync(f, "utf8");
  if (!body.endsWith("\n")) {
    body += "\n";
  }
}

fs.mkdirSync(path.dirname(outMerged), { recursive: true });
const rawMerged = header + body;
fs.writeFileSync(outMerged, rawMerged, "utf8");
console.log(`[merge-scss] wrote ${path.relative(themeRoot, outMerged)} (${files.length} file(s))`);

let sass;
try {
  sass = require("sass");
} catch {
  console.error("[merge-scss] The `sass` package is required. Install: npm install sass --save-dev");
  process.exit(1);
}

const sassOpts = {
  style: minify ? "compressed" : "expanded",
  loadPaths: [themeRoot, path.join(themeRoot, "web", "tailwind")],
  url: pathToFileURL(outMerged),
};
if (sourceMap) {
  sassOpts.sourceMap = true;
  sassOpts.sourceMapIncludeSources = true;
}

try {
  const compiled = sass.compileString(rawMerged, sassOpts);
  let cssOut = compiled.css;
  if (sourceMap && compiled.sourceMap != null) {
    const mapJson =
      typeof compiled.sourceMap === "string" ? compiled.sourceMap : JSON.stringify(compiled.sourceMap);
    fs.writeFileSync(outMergedCssMap, mapJson, "utf8");
    if (!/\bsourceMappingURL\b/.test(cssOut)) {
      cssOut += `\n/*# sourceMappingURL=_merged.css.map */\n`;
    }
  } else if (fs.existsSync(outMergedCssMap)) {
    try {
      fs.unlinkSync(outMergedCssMap);
    } catch (_) {
      /* ignore */
    }
  }
  fs.writeFileSync(outMergedCss, cssOut, "utf8");
  console.log(
    `[merge-scss] wrote ${path.relative(themeRoot, outMergedCss)} (sass ${minify ? "compressed" : "expanded"}${sourceMap ? ", source map" : ""})`,
  );
} catch (e) {
  console.error("[merge-scss] Sass compile failed:", e.message || e);
  process.exit(1);
}

const extraContent = Array.isArray(cfg.contentFiles) ? cfg.contentFiles : [];
fs.writeFileSync(
  outContentRoots,
  JSON.stringify({ files: extraContent }, null, 2),
  "utf8",
);
console.log(`[merge-scss] wrote ${path.relative(themeRoot, outContentRoots)} (${extraContent.length} extra path(s))`);
