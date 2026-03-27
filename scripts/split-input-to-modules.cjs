#!/usr/bin/env node
/**
 * One-time split of legacy monolithic input.css body into web/tailwind/modules/*.scss
 * Line numbers match input.css before slimming (run from theme root).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const themeRoot = path.resolve(__dirname, "..");
const inputPath = path.join(themeRoot, "web", "tailwind", "input.css");
const outDir = path.join(themeRoot, "web", "tailwind", "modules");

const lines = fs.readFileSync(inputPath, "utf8").split(/\r?\n/);

function extractRanges(ranges) {
  const parts = [];
  for (const [a, b] of ranges) {
    const slice = lines.slice(a - 1, b);
    parts.push(slice.join("\n"));
  }
  return parts.join("\n\n");
}

/** @type {Record<string, [number, number][]>} */
const manifest = {
  "base.scss": [
    [10, 24],
    [2024, 2045],
    [2785, 2798],
  ],
  "layout.scss": [
    [26, 327],
    [1159, 1287],
  ],
  "header.scss": [
    [94, 101],
    [112, 174],
    [329, 810],
    [1965, 2022],
  ],
  "navigation.scss": [
    [978, 1157],
    [2211, 2522],
  ],
  "footer.scss": [
    [103, 110],
    [176, 258],
    [2524, 2559],
  ],
  "actions-forms.scss": [[811, 976]],
  "catalog.scss": [
    [1289, 1306],
    [1308, 1918],
    [2664, 2783],
  ],
  "messages-tables.scss": [
    [1920, 1963],
    [2561, 2662],
  ],
  "cms.scss": [[2047, 2209]],
};

fs.mkdirSync(outDir, { recursive: true });
for (const [name, ranges] of Object.entries(manifest)) {
  const content = extractRanges(ranges) + "\n";
  fs.writeFileSync(path.join(outDir, name), content, "utf8");
  console.log("wrote", path.join("web/tailwind/modules", name));
}
