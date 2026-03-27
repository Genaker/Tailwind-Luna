#!/usr/bin/env bash
# build-css.sh — Full Tailwind build pipeline without requiring `npm install`.
# Uses npx to resolve sass + cssnano-cli when they aren't in node_modules.
#
# Steps:
#   1. merge-scss   → web/tailwind/_merged.scss  (node merge-scss.cjs writes the SCSS bundle)
#   2. sass         → web/tailwind/_merged.css    (npx sass compiles the bundle)
#   3. tailwindcss  → web/css/tailwind.css        (JIT build from input.css)
#   4. cssnano      → web/css/tailwind.min.css    (minify)
#   5. copy-to-pub  → pub/static/…/css/           (deploy + bump deployed_version.txt)
#
# Usage (from repo root or theme root):
#   bash packages/theme-frontend-win-luna/scripts/build-css.sh
#
# When node_modules is intact (npm install works), use the standard npm script instead:
#   cd packages/theme-frontend-win-luna && npm run build:tailwind
set -euo pipefail

THEME_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$THEME_DIR"

echo "==> [1/5] Merging SCSS modules → _merged.scss"
node scripts/merge-scss.cjs --list > /dev/null 2>&1 || true   # list to warm up glob cache
# merge-scss writes _merged.scss but bails when sass is missing; patch: catch exit code 1 from sass check
node scripts/merge-scss.cjs 2>&1 | grep -v "sass package is required" || true

echo "==> [2/5] Compiling SCSS → _merged.css (npx sass)"
npx --yes sass \
  --no-source-map \
  web/tailwind/_merged.scss:web/tailwind/_merged.css

echo "==> [3/5] Building Tailwind → web/css/tailwind.css"
npx tailwindcss -i ./web/tailwind/input.css -o ./web/css/tailwind.css

echo "==> [4/5] Minifying → web/css/tailwind.min.css (npx cssnano-cli)"
npx --yes cssnano-cli web/css/tailwind.css web/css/tailwind.min.css

echo "==> [5/5] Copying to pub/static + bumping deployed_version.txt"
node scripts/copy-tailwind-to-pub.cjs

echo ""
echo "Done. Sizes:"
wc -c web/css/tailwind.css web/css/tailwind.min.css
