/**
 * Layered scss.config.json: theme package `web/tailwind/scss.config.json` first, then each
 * Magento module `…/view/frontend/web/tailwind/scss.config.json` (vendor, app/code, src).
 * Later files override pubStaticPath(s); mergeRoots / exclude / contentFiles accumulate (deduped).
 * Paths in a module config are relative to that file's directory; theme config paths use theme root.
 *
 * Optional `tier` (0–2, default 2): applies to mergeRoots from that config and to all SCSS under
 * that module’s `…/web/tailwind/` directory (non-theme configs only). Theme `web/tailwind/modules`
 * and `extensions` still use path-based tiers 0 and 1 first.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");

const THEME_CONFIG_REL = "web/tailwind/scss.config.json";

/** Known keys; others log a warning (typos). */
const KNOWN_KEYS = new Set([
  "mergeRoots",
  "exclude",
  "contentFiles",
  "pubStaticPath",
  "pubStaticPaths",
  "tier",
]);

const KNOWN_YAML_KEYS = new Set(["inputs", "exclude", "tier", "output"]);

/**
 * Minimal YAML parser for styles.yaml.
 * Supports: top-level scalar keys, sequence values (- item), inline comments (#).
 * Does NOT support nested maps, multi-document, anchors, or flow sequences.
 *
 * Format (all keys optional):
 *   inputs:
 *     - view/frontend/web/css/custom.scss
 *   tier: 2
 *   exclude:
 *     - view/frontend/web/css/old.scss
 *   output: css/output.css   # informational only, not used by merge-scss
 */
function parseStylesYaml(text) {
  const result = {};
  let currentKey = null;
  let currentList = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trimEnd(); // strip inline comments
    if (!line.trim()) continue;

    // Sequence item: "  - value"
    const listItem = line.match(/^[ \t]+-[ \t]+(.+)$/);
    if (listItem) {
      if (currentList !== null) {
        currentList.push(listItem[1].trim().replace(/^['"]|['"]$/g, ""));
      }
      continue;
    }

    // Key: value (scalar)  OR  key: (list follows)
    const kvMatch = line.match(/^(\w[\w.-]*)[ \t]*:[ \t]*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1].trim();
      const val = kvMatch[2].trim().replace(/^['"]|['"]$/g, "");
      if (val === "" || val === null) {
        // Value is a list on next lines
        currentList = [];
        result[currentKey] = currentList;
      } else {
        currentList = null;
        result[currentKey] = val;
      }
    }
  }

  return result;
}

function warnUnknownYamlKeys(parsed, yamlPath, themeRoot) {
  for (const k of Object.keys(parsed)) {
    if (!KNOWN_YAML_KEYS.has(k)) {
      console.warn(
        `[scss-config] unknown key "${k}" in ${path.relative(themeRoot, yamlPath)} (ignored)`,
      );
    }
  }
}

const CONFIG_DEFAULTS = {
  mergeRoots: [],
  contentFiles: [],
  pubStaticPath: null,
  pubStaticPaths: null,
  exclude: [],
};

function warnUnknownKeys(parsed, configPath, themeRoot) {
  for (const k of Object.keys(parsed)) {
    if (!KNOWN_KEYS.has(k)) {
      console.warn(
        `[scss-config] unknown key "${k}" in ${path.relative(themeRoot, configPath)} (ignored)`,
      );
    }
  }
}

function clampTier(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2;
  return Math.min(2, Math.max(0, Math.floor(n)));
}

function normalizeMergeRootPrefix(abs) {
  const norm = path.normalize(abs);
  if (fs.existsSync(norm) && fs.statSync(norm).isFile()) {
    return path.normalize(path.dirname(norm));
  }
  return norm;
}

function collectScssConfigPaths(themeRoot) {
  const paths = [];
  const themeCfg = path.join(themeRoot, THEME_CONFIG_REL);
  if (fs.existsSync(themeCfg)) {
    paths.push(themeCfg);
  }

  const { scssConfigGlobs } = require("./sources.cjs");
  const seen = new Set(paths);
  for (const g of scssConfigGlobs) {
    const matches = globSync(g, { cwd: themeRoot, absolute: true, nodir: true });
    for (const p of matches.sort((a, b) => a.localeCompare(b))) {
      if (!seen.has(p)) {
        seen.add(p);
        paths.push(p);
      }
    }
  }
  return paths;
}

function collectStylesYamlPaths(themeRoot) {
  const { stylesYamlGlobs } = require("./sources.cjs");
  const seen = new Set();
  const paths = [];
  for (const g of stylesYamlGlobs) {
    const matches = globSync(g, {
      cwd: themeRoot,
      absolute: true,
      nodir: true,
      ignore: ["**/node_modules/**"],
    });
    for (const p of matches.sort((a, b) => a.localeCompare(b))) {
      if (!seen.has(p)) {
        seen.add(p);
        paths.push(p);
      }
    }
  }
  return paths;
}

function isThemeConfigFile(themeRoot, configPath) {
  return path.normalize(configPath) === path.normalize(path.join(themeRoot, THEME_CONFIG_REL));
}

/**
 * @param {string} themeRoot Absolute theme package root
 * @param {{ verbose?: boolean }} [options]
 */
function loadMergedScssConfig(themeRoot, options) {
  const verbose = Boolean(options && options.verbose);
  const paths = collectScssConfigPaths(themeRoot);
  const merged = {
    mergeRoots: [],
    excludeBatches: [],
    contentFiles: [],
    pubStaticPath: null,
    pubStaticPaths: null,
    /** Longest-prefix wins per file path; see merge-scss.cjs tierForFile */
    tierPrefixes: [],
  };

  paths.forEach((configPath, index) => {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (e) {
      console.warn(`[scss-config] invalid ${path.relative(themeRoot, configPath)}:`, e.message);
      return;
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      warnUnknownKeys(parsed, configPath, themeRoot);
    }
    const raw = { ...CONFIG_DEFAULTS, ...parsed };
    const isTheme = isThemeConfigFile(themeRoot, configPath);
    const baseDir = isTheme ? themeRoot : path.dirname(configPath);
    const tier = clampTier(raw.tier);

    if (verbose) {
      const rel = path.relative(themeRoot, configPath);
      console.log(`[merge-scss] config ${index + 1}/${paths.length}: ${rel}`);
      console.log(
        `  tier=${tier} mergeRoots=${(raw.mergeRoots || []).length} exclude=${(raw.exclude || []).length} contentFiles=${(raw.contentFiles || []).length}`,
      );
    }

    for (const r of raw.mergeRoots || []) {
      if (!r || typeof r !== "string") continue;
      const abs = path.isAbsolute(r) ? path.normalize(r) : path.resolve(baseDir, r);
      if (!merged.mergeRoots.includes(abs)) {
        merged.mergeRoots.push(abs);
        merged.tierPrefixes.push({ prefix: normalizeMergeRootPrefix(abs), tier });
      }
    }

    if (!isTheme) {
      const modDir = path.normalize(path.dirname(configPath));
      merged.tierPrefixes.push({ prefix: modDir, tier });
    }

    const ex = Array.isArray(raw.exclude) ? raw.exclude.filter((x) => x && typeof x === "string") : [];
    if (ex.length > 0) {
      merged.excludeBatches.push({ cwd: baseDir, patterns: ex });
    }

    for (const c of raw.contentFiles || []) {
      if (typeof c === "string" && c.length > 0 && !merged.contentFiles.includes(c)) {
        merged.contentFiles.push(c);
      }
    }

    if (Array.isArray(raw.pubStaticPaths) && raw.pubStaticPaths.length > 0) {
      merged.pubStaticPaths = [...raw.pubStaticPaths];
      merged.pubStaticPath = null;
    } else if (typeof raw.pubStaticPath === "string" && raw.pubStaticPath.length > 0) {
      merged.pubStaticPath = raw.pubStaticPath;
      merged.pubStaticPaths = null;
    }
  });

  // ── styles.yaml ──────────────────────────────────────────────────────────────
  // Discovered at module/theme roots (not inside web/tailwind/).
  // Each file declares `inputs` (SCSS files relative to the yaml) and optional `tier`.
  const yamlPaths = collectStylesYamlPaths(themeRoot);
  yamlPaths.forEach((yamlPath, index) => {
    let parsed;
    try {
      parsed = parseStylesYaml(fs.readFileSync(yamlPath, "utf8"));
    } catch (e) {
      console.warn(`[scss-config] invalid ${path.relative(themeRoot, yamlPath)}:`, e.message);
      return;
    }

    warnUnknownYamlKeys(parsed, yamlPath, themeRoot);

    const baseDir = path.dirname(yamlPath);
    const tier = clampTier(parsed.tier !== undefined ? parsed.tier : 2);

    if (verbose) {
      const rel = path.relative(themeRoot, yamlPath);
      const inputs = Array.isArray(parsed.inputs) ? parsed.inputs : [];
      console.log(
        `[merge-scss] styles.yaml ${index + 1}/${yamlPaths.length}: ${rel} (tier=${tier}, inputs=${inputs.length})`,
      );
    }

    const inputs = Array.isArray(parsed.inputs) ? parsed.inputs : [];
    for (const input of inputs) {
      if (!input || typeof input !== "string") continue;
      const abs = path.isAbsolute(input) ? path.normalize(input) : path.resolve(baseDir, input);
      if (!merged.mergeRoots.includes(abs)) {
        merged.mergeRoots.push(abs);
        merged.tierPrefixes.push({ prefix: normalizeMergeRootPrefix(abs), tier });
      }
    }

    // Register module dir so all its web/tailwind scss inherits the tier
    merged.tierPrefixes.push({ prefix: path.normalize(baseDir), tier });

    const excludes = Array.isArray(parsed.exclude) ? parsed.exclude : [];
    if (excludes.length > 0) {
      merged.excludeBatches.push({
        cwd: baseDir,
        patterns: excludes.filter((x) => x && typeof x === "string"),
      });
    }
  });
  // ─────────────────────────────────────────────────────────────────────────────

  const byPrefix = new Map();
  for (const { prefix, tier } of merged.tierPrefixes) {
    byPrefix.set(path.normalize(prefix), tier);
  }
  merged.tierPrefixes = [...byPrefix.entries()].map(([prefix, tier]) => ({ prefix, tier }));

  return merged;
}

module.exports = {
  loadMergedScssConfig,
  CONFIG_DEFAULTS,
  THEME_CONFIG_REL,
  KNOWN_KEYS,
  KNOWN_YAML_KEYS,
  clampTier,
  parseStylesYaml,
};
