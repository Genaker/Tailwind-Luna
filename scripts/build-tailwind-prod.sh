#!/usr/bin/env bash
# Production Tailwind / Tilewind pipeline — same outputs as `npm run build:tailwind`, except:
#   - merge-scss runs with `--minify` (compressed _merged.css)
#   - NODE_ENV=production + TAILWIND_CSS_PROD=1 (cssnano runs only in emit-tailwind-min-alias.cjs, not in postcss.config)
#
# Steps: tilewindscss (merge) → tailwind CLI → tailwind.min alias → checkout minify → copy to pub/static
# Requires devDependencies: sass, cssnano, tailwindcss, postcss, … (run `npm install` in this package).
set -euo pipefail
cd "$(dirname "$0")/.."
export NODE_ENV=production
export TAILWIND_CSS_PROD=1
# Prefer this package's node_modules when resolving postcss plugins
export NODE_PATH="${PWD}/node_modules${NODE_PATH:+:$NODE_PATH}"

npm run build:tilewindscss -- --minify
./node_modules/.bin/tailwindcss -i ./web/tailwind/input.css -o ./web/css/tailwind.css
node scripts/emit-tailwind-min-alias.cjs
node scripts/minify-checkout.cjs
node scripts/copy-tailwind-to-pub.cjs
