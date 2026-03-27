# SCSS merge (`build:tilewindscss`)

The **`npm run build:tilewindscss`** script runs **`scripts/merge-scss.cjs`**. It:

1. Loads **layered** **`scss.config.json`** files (see below).
2. Concatenates all matching **`*.scss`** into **`web/tailwind/_merged.scss`** (deterministic order, with a file list header).
3. Compiles that bundle with **Sass** into **`web/tailwind/_merged.css`** (Tailwind imports this file, not raw SCSS).

Implementation details: **`web/tailwind/scss-config.cjs`** (merge config), **`web/tailwind/sources.cjs`** (globs).

## Flags

| Flag | Effect |
|------|--------|
| *(none)* | Sass output style **`expanded`** (readable **`_merged.css`**). |
| **`--minify`**, **`-m`** | Sass output style **`compressed`** (smaller **`_merged.css`**). |
| **`--list`**, **`-l`** | Print merged file paths in order to **stdout** and **exit** (no writes). |
| **`--verbose`**, **`-v`** | Log each config layer and **`files by tier`** counts. |
| **`--source-map`** | Emit **`web/tailwind/_merged.css.map`** and a **`sourceMappingURL`** in **`_merged.css`** (DevTools map to original `.scss`). |

**Help:** `node scripts/merge-scss.cjs --help`

**NPM shortcuts:** **`npm run build:tilewindscss:min`** → merge with **`--minify`**.

Requires the **`sass`** package (`npm install`).

## Why merge?

- **One pipeline** for theme partials, optional extension folders, and **SCSS colocated with Magento modules** (`view/frontend/web/tailwind/`).
- **Deterministic order**: **tier** (see below), then **path segments** with **numeric filename prefixes** (`10-name.scss`, `20-name.scss`, `11-` between them) sorted numerically.
- **No `.tcss` / duplicate formats** — only `.scss` sources merged; **one compiled CSS** file is what **`input.css`** imports.

## Merge order (tiers)

1. **Tier 0** — `web/tailwind/modules/**` (theme “core” partials).
2. **Tier 1** — `web/tailwind/extensions/**`.
3. **Tier 2** — everything else by default (vendor / `app/code` / `src` / extra **`mergeRoots`**).

**Module override:** in a **non-theme** `…/view/frontend/web/tailwind/scss.config.json`, optional **`"tier": 0`** or **`1`** pulls that module’s SCSS (and its **`mergeRoots`**) into an earlier tier. Longest matching path prefix wins when several configs apply.

Within a tier, paths are sorted **segment by segment**; a segment like **`10-foo.scss`** is ordered by the leading integer (not plain lexicographic sort).

## Default glob roots

Paths are **relative to the theme package root** (directory that contains `web/tailwind/`). Defined in **`web/tailwind/sources.cjs`** as **`scssRootGlobs`**:

| Glob | Meaning |
|------|---------|
| `web/tailwind/modules/**/*.scss` | Theme “module” partials (layout, catalog, header, …). |
| `web/tailwind/extensions/**/*.scss` | Optional add-on partials. |
| `../../vendor/magento/module-*/view/frontend/web/tailwind/**/*.scss` | Core and third-party Composer packages under **`vendor/magento/module-*`**. |
| `../../app/code/*/*/view/frontend/web/tailwind/**/*.scss` | Project modules in **`app/code`**. |
| `../../src/**/view/frontend/web/tailwind/**/*.scss` | Monorepo-style **`src`** trees. |

**Ignored:** `**/*.scss.example`, `**/node_modules/**`.

## Layered config: `scss.config.json`

Configs are merged in this order:

1. **Theme:** `web/tailwind/scss.config.json` (paths relative to **theme package root**).
2. **Modules:** each `…/view/frontend/web/tailwind/scss.config.json` discovered under **`scssConfigGlobs`** in **`sources.cjs`** (vendor, `app/code`, `src`), sorted by path.

**Behavior:**

| Concern | Rule |
|---------|------|
| **`mergeRoots`** | Appended, deduped (absolute paths). Relative entries resolve from **theme root** (theme config) or from **that config file’s directory** (module config). |
| **`exclude`** | Glob patterns; **`cwd`** is theme root for the theme config, or the module’s `…/web/tailwind/` for module configs. |
| **`contentFiles`** | Appended, deduped → **`_content-roots.json`** for Tailwind JIT. |
| **`pubStaticPath`** / **`pubStaticPaths`** | **Last** non-empty definition wins (used by **`copy-tailwind-to-pub.cjs`**). |
| **`tier`** | Optional **0–2** (default **2**) on any config; see **Merge order** above. |

Unknown JSON keys log **`[scss-config] unknown key "…" (ignored)`**.

Theme template: **`web/tailwind/scss.config.example.json`**.

Invalid JSON in a file logs a warning and that file is skipped.

## Merge output format

**`_merged.scss`** starts with an auto-generated header comment listing **all source files** and their count. Each file is emitted as:

```scss
/* ---- relative/path/to/file.scss ---- */
...file contents...
```

**`_merged.css`** is the **Sass-compiled** CSS from that bundle (expanded or compressed per flags).

## Entry file: `input.css` order matters

**`@import "./_merged.css"` must appear before `@tailwind base` (and the other `@tailwind` lines).**

PostCSS **`postcss-import`** follows the CSS rule that `@import` is only processed when it appears **before** other rules. The `@tailwind` directives count as “other rules”, so putting the import **after** them would **silently drop** the merged CSS from the build.

Correct order:

```css
@import "./_merged.css";

@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Tailwind `content` vs merge

- **Merge** = which **`.scss`** files are **concatenated** and compiled into **`_merged.css`** (custom CSS, `@layer`, `@apply`, variables).
- **`content` in `tailwind.config.js`** = which **templates / XML / HTML / SCSS** Tailwind **scans** to decide which **utility classes** to emit.

Both are driven from **`sources.cjs`** (`scssRootGlobs` vs `contentFiles`) so vendor/module paths stay aligned. Extra **`contentFiles`** from layered **`scss.config.json`** are merged at build time into **`_content-roots.json`**.

## Tests

- **`npm run test:scss`** — fast: **`merge-scss-modules.test.cjs`** + **`merge-scss-config.test.cjs`** (merge order, config layers, flags, **`tier`**, excludes).
- **`npm run test:build`** — full Tailwind pipeline + pub checks (slower). See **`scripts/tests/`**.

## Commands

```bash
npm run build:tilewindscss        # merge → _merged.scss + _merged.css + _content-roots.json
npm run build:tilewindscss:min    # merge with Sass compressed _merged.css
npm run build:tailwind            # merge + Tailwind CLI → web/css/tailwind.css + emit + pub + deployed_version.txt
npm run build:tailwind:opt        # compressed _merged.css + same pipeline
npm run build:tailwind:prod       # production env + compressed merge (see CSS_BUILD_ARCHITECTURE.md)
npm run watch:tailwind            # chokidar: re-merge + Tailwind when theme or module tailwind SCSS/config changes
npm run test:scss                 # merge-only tests (no full Tailwind build)
```

See [CSS_BUILD_ARCHITECTURE.md](./CSS_BUILD_ARCHITECTURE.md) for the full pipeline, **Browserslist**, and **PostCSS** (including **cssnano**). For **app/code / vendor extensions** (new code, migration, layout-only CSS), see [TAILWIND_EXTENSION_DEVELOPMENT.md](./TAILWIND_EXTENSION_DEVELOPMENT.md).
