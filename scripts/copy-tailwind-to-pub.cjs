#!/usr/bin/env node
/**
 * Copy theme CSS (tailwind.css, checkout.css) to pub/static/<theme>/css/ for fast dev refresh.
 * Destinations: layered scss.config.json (theme + module …/web/tailwind/scss.config.json) or sources.cjs defaults.
 * The theme registers as Genaker/tailwind_luna and Genaker/win_luna — both get the files unless overridden.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { bumpStaticDeployVersion } = require("./bump-static-deploy-version.cjs");

const themeRoot = path.resolve(__dirname, "..");
const magentoRoot = path.resolve(themeRoot, "..", "..");

/** Files under web/css/ to mirror into each pub/static theme path */
const FILES_TO_COPY = ["tailwind.css", "tailwind.min.css", "checkout.min.css"];
const { loadMergedScssConfig } = require(path.join(themeRoot, "web", "tailwind", "scss-config.cjs"));
const { defaultPubStaticPaths } = require(path.join(themeRoot, "web", "tailwind", "sources.cjs"));

/** @type {string[]} */
let destinations = [...defaultPubStaticPaths];
const merged = loadMergedScssConfig(themeRoot);
if (Array.isArray(merged.pubStaticPaths) && merged.pubStaticPaths.length > 0) {
  destinations = merged.pubStaticPaths;
} else if (typeof merged.pubStaticPath === "string" && merged.pubStaticPath.length > 0) {
  destinations = [merged.pubStaticPath];
}

for (const name of FILES_TO_COPY) {
  const srcCss = path.join(themeRoot, "web", "css", name);
  if (!fs.existsSync(srcCss)) {
    console.warn("[copy-tailwind-to-pub] skip (missing):", path.relative(themeRoot, srcCss));
    continue;
  }

  for (const pubRel of destinations) {
    const destDir = path.join(magentoRoot, pubRel, "css");
    const destFile = path.join(destDir, name);
    fs.mkdirSync(destDir, { recursive: true });
    try {
      fs.rmSync(destFile, { force: true });
    } catch (_) {
      /* ignore */
    }
    fs.copyFileSync(srcCss, destFile);
    console.log(`[copy-tailwind-to-pub] ${path.relative(magentoRoot, srcCss)} → ${path.relative(magentoRoot, destFile)}`);
  }
}

bumpStaticDeployVersion(magentoRoot);
