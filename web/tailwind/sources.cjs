/**
 * Single source of truth for SCSS merge roots and Tailwind content globs.
 * Paths are relative to the theme package root (parent of web/tailwind).
 */
const path = require("path");

const themeRoot = path.join(__dirname, "..", "..");

/** @type {string[]} */
const scssRootGlobs = [
  "web/tailwind/modules/**/*.scss",
  "web/tailwind/extensions/**/*.scss", // merge order: after modules (see scripts/merge-scss.cjs)
  // Magento module SCSS (same path in vendor, app/code, or src): …/view/frontend/web/tailwind/*.scss
  "../../vendor/magento/module-*/view/frontend/web/tailwind/**/*.scss",
  "../../app/code/*/*/view/frontend/web/tailwind/**/*.scss",
  "../../src/**/view/frontend/web/tailwind/**/*.scss",
];

/** Optional layered merge config (theme first, then these paths, sorted). See scss-config.cjs */
const scssConfigGlobs = [
  "../../vendor/magento/module-*/view/frontend/web/tailwind/scss.config.json",
  "../../app/code/*/*/view/frontend/web/tailwind/scss.config.json",
  "../../src/**/view/frontend/web/tailwind/scss.config.json",
];

/**
 * styles.yaml discovery — placed at module/theme root (not inside web/tailwind/).
 * Inspired by OroInc frontend architecture: https://doc.oroinc.com/frontend/storefront/css/
 * Format: inputs (list of SCSS paths relative to the yaml file), tier (0-2), exclude (list).
 */
const stylesYamlGlobs = [
  "styles.yaml",
  "styles.yml",
  "../../vendor/magento/module-*/styles.yaml",
  "../../vendor/magento/module-*/styles.yml",
  "../../app/code/*/*/styles.yaml",
  "../../app/code/*/*/styles.yml",
  "../../src/**/styles.yaml",
  "../../src/**/styles.yml",
];

/** @type {string[]} */
const contentFiles = [
  "./Magento_*/**/*.phtml",
  "./Magento_*/**/*.xml",
  "./Magento_*/web/template/**/*.html",
  "./Magento_*/web/templates/**/*.html",
  "./web/tailwind/**/*.scss",
  "./web/tailwind/css-safelist.html",
  "../../vendor/magento/module-*/view/frontend/templates/**/*.phtml",
  "../../vendor/magento/module-*/view/frontend/layout/**/*.xml",
  "../../vendor/magento/module-*/view/frontend/web/template/**/*.html",
  "../../vendor/magento/module-*/view/frontend/web/tailwind/**/*.scss",
  "../../app/code/*/*/view/frontend/templates/**/*.phtml",
  "../../app/code/*/*/view/frontend/layout/**/*.xml",
  "../../app/code/*/*/view/frontend/web/template/**/*.html",
  "../../app/code/*/*/view/frontend/web/tailwind/**/*.scss",
  "../../app/design/frontend/*/*/Magento_*/templates/**/*.phtml",
  "../../app/design/frontend/*/*/Magento_*/layout/**/*.xml",
  "../../src/**/view/frontend/templates/**/*.phtml",
  "../../src/**/view/frontend/web/tailwind/**/*.scss",
];

/** Primary storefront theme code (see registration.php — same package also registers win_luna). */
const defaultPubStaticPath = "pub/static/frontend/Genaker/tailwind_luna/en_US";

/** Copy build output to every path the theme is registered under so dev refresh works for either code. */
const defaultPubStaticPaths = [
  defaultPubStaticPath,
  "pub/static/frontend/Genaker/win_luna/en_US",
];

module.exports = {
  themeRoot,
  scssRootGlobs,
  scssConfigGlobs,
  stylesYamlGlobs,
  contentFiles,
  defaultPubStaticPath,
  defaultPubStaticPaths,
};
