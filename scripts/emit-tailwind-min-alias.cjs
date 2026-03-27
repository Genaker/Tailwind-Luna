#!/usr/bin/env node
/**
 * Single production minify pass for Tailwind output.
 *
 * - Tailwind CLI is run **without** `--minify` so the CSS still has structure cssnano can optimize
 *   (Tailwind’s own minifier + a second cssnano pass barely shrinks the file).
 * - cssnano writes `tailwind.min.css` and the same bytes to `tailwind.css` so ResolveCss fallback
 *   matches prod size.
 *
 * **Larger wins** than squeezing minifiers: narrow `web/tailwind/sources.cjs` `contentFiles` so JIT
 * emits fewer utilities; `@apply` in SCSS still pulls utilities into the bundle — prefer utilities
 * in templates when you want tree-shaking to match real DOM classes.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const postcss = require("postcss");

const themeRoot = path.resolve(__dirname, "..");
const srcPath = path.join(themeRoot, "web", "css", "tailwind.css");
const outMinPath = path.join(themeRoot, "web", "css", "tailwind.min.css");

async function main() {
  if (!fs.existsSync(srcPath)) {
    console.error("[emit-tailwind-min-alias] missing:", srcPath);
    process.exit(1);
  }

  let cssnano;
  try {
    cssnano = require("cssnano");
  } catch {
    console.error("[emit-tailwind-min-alias] Missing `cssnano`. Run: npm install cssnano --save-dev");
    process.exit(1);
  }

  const input = fs.readFileSync(srcPath, "utf8");
  const result = await postcss([
    cssnano({
      preset: ["default", { discardComments: { removeAll: true } }],
    }),
  ]).process(input, { from: srcPath, to: outMinPath });

  fs.writeFileSync(outMinPath, result.css, "utf8");
  fs.writeFileSync(srcPath, result.css, "utf8");

  console.log(
    `[emit-tailwind-min-alias] tailwind (expanded) → cssnano → tailwind.css + tailwind.min.css (${input.length} → ${result.css.length} bytes)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
