#!/usr/bin/env node
/**
 * Minify web/css/checkout.css → web/css/checkout.min.css (cssnano).
 * ResolveCss prefers checkout.min.css when present.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const postcss = require("postcss");

const themeRoot = path.resolve(__dirname, "..");
const srcPath = path.join(themeRoot, "web", "css", "checkout.css");
const outPath = path.join(themeRoot, "web", "css", "checkout.min.css");

async function main() {
  let cssnano;
  try {
    cssnano = require("cssnano");
  } catch {
    console.error("[minify-checkout] Missing `cssnano`. Run: npm install cssnano --save-dev");
    process.exit(1);
  }

  const input = fs.readFileSync(srcPath, "utf8");
  const result = await postcss([
    cssnano({
      preset: ["default", { discardComments: { removeAll: true } }],
    }),
  ]).process(input, { from: srcPath, to: outPath });

  fs.writeFileSync(outPath, result.css, "utf8");
  console.log(
    `[minify-checkout] ${path.relative(themeRoot, srcPath)} → ${path.relative(themeRoot, outPath)} (${result.css.length} bytes)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
