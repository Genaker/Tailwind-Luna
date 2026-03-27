#!/usr/bin/env node
/**
 * Re-run merge-scss + Tailwind when theme or Magento module tailwind SCSS / scss.config.json changes.
 * (Tailwind --watch alone does not re-merge vendor/module SCSS or reload layered configs.)
 */
"use strict";

const path = require("path");
const { execSync } = require("child_process");
const chokidar = require("chokidar");

const themeRoot = path.resolve(__dirname, "..");
const magentoRoot = path.resolve(themeRoot, "..", "..");

const patterns = [
  path.join(themeRoot, "web", "tailwind", "**", "*.{scss,css}"),
  path.join(themeRoot, "web", "tailwind", "scss.config.json"),
  path.join(magentoRoot, "vendor", "**", "view", "frontend", "web", "tailwind", "**", "*.{scss,json}"),
  path.join(magentoRoot, "app", "code", "**", "view", "frontend", "web", "tailwind", "**", "*.{scss,json}"),
  path.join(magentoRoot, "src", "**", "view", "frontend", "web", "tailwind", "**", "*.{scss,json}"),
];

function rebuild() {
  console.log("[watch-tailwind] rebuilding…");
  execSync("node scripts/merge-scss.cjs", { cwd: themeRoot, stdio: "inherit" });
  execSync("tailwindcss -i ./web/tailwind/input.css -o ./web/css/tailwind.css", { cwd: themeRoot, stdio: "inherit" });
}

rebuild();

let timer = null;
chokidar
  .watch(patterns, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
  })
  .on("all", () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 300);
  });

console.log("[watch-tailwind] watching SCSS + scss.config.json under theme and Magento module tailwind paths…");
