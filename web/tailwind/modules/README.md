# Theme SCSS modules (`*.scss`)

Core storefront CSS lives here as partials. Merge order is **tier 0 (this folder) → tier 1 extensions → tier 2 vendor/app/src** (`scripts/merge-scss.cjs`); within `modules/`, paths sort **segment by segment** with **numeric filename prefixes** (`10-`, `20-`, `11-` between them) so order stays predictable. See **[docs/CSS_MERGE.md](../../docs/CSS_MERGE.md)**. Output is **`_merged.scss`** then **`_merged.css`** (Sass) when you run:

```bash
npm run build:tilewindscss
```

`npm run build:tailwind` runs that step first, then compiles Tailwind to `web/css/tailwind.css`.

## Layout of this folder

Top-level folder names sort **alphabetically** (`actions-forms` → … → `navigation`). `catalog/` uses **`10-` / `20-` / `30-` / `40-` prefixes** on partials so you can insert **`11-`**, **`12-`**, etc. between steps without relying on lexicographic order alone.

| Folder | Role |
|--------|------|
| `actions-forms` | Global buttons, form fields, validation (`.action.*`, `.input-text`, `.mage-error`) |
| `base` | Body, print, switcher, cross-cutting utilities |
| `catalog` | Catalog / product UI: split by **page type** and **concern** (see below) |
| `cms` | CMS pages, widgets, homepage promos (`block-promo`, links) |
| `footer` | Footer grid, newsletter hook, copyright |
| `header` | Header strip, search, minicart, logo, compare |
| `layout` | Page shell (`.page-wrapper`, columns, breadcrumbs, page title) — loads after chrome so shared layout rules stay consistent |
| `messages-tables` | Flash messages, tables, pagination, compare/wishlist blocks |
| `navigation` | Primary nav, mobile drawer, `nav-sections`, mini-search |

### `catalog/` (catalog + product)

| File | Criteria |
|------|----------|
| `10-plp-grids.scss` | **Category / listing / widgets**: grid & list layouts, product grids, related/upsell/cross-sell horizontal tracks (use `11-`, `12-`… between `10-` and `20-` if needed) |
| `20-product-cards.scss` | **Shared product cards**: `.product-item`, pricing, ratings, wishlist/compare icons, primary/secondary actions |
| `30-plp-toolbar.scss` | **Category toolbar**: sort, view modes, limiter (layered nav is mostly Tailwind in templates) |
| `40-swatches.scss` | **Configurable options**: `.swatch-opt`, `.swatch-option` (category cards + PDP) |

- Add new partials under this tree; they are picked up automatically by `web/tailwind/**/*.scss` globs.
- Files named `*.scss.example` are ignored.

See `web/tailwind/scss.config.example.json` for optional extra merge roots and Tailwind content paths.
