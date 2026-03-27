/**
 * Tailwind CLI loads this automatically. postcss-import must run before tailwindcss
 * so @import "./_merged.css" in input.css is inlined (compiled from merged SCSS by merge-scss.cjs).
 *
 * Do **not** run cssnano here — `scripts/emit-tailwind-min-alias.cjs` minifies once after Tailwind
 * (avoids Tailwind `--minify` + PostCSS cssnano + emit cssnano fighting each other for ~0 net gain).
 */
const scss = require("postcss-scss");

const plugins = {
  /* postcss-scss allows @tailwind and plain CSS; merged bundle is already compiled CSS */
  "postcss-import": { syntax: scss },
  tailwindcss: {},
  autoprefixer: {},
};

module.exports = { plugins };
