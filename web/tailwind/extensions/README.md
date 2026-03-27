# Tailwind extension partials (`*.scss`)

Drop **`*.scss`** files here (any subdirectory). They are concatenated **after** `web/tailwind/modules/` (core theme), then sorted by path within each group, into **`_merged.scss`** / **`_merged.css`** when you run:

```bash
npm run build:tilewindscss
```

`npm run build:tailwind` runs merge first. **`npm run watch:tailwind`** re-runs merge + Tailwind when theme or Magento module **`tailwind`** SCSS / **`scss.config.json`** changes (see **[docs/CSS_MERGE.md](../../docs/CSS_MERGE.md)**).

- Use **`@layer components`**, **`@layer utilities`**, or **`@apply`** as in normal Tailwind + SCSS.
- Files named **`*.scss.example`** are ignored (templates only).
- To merge from other paths (e.g. a Composer package under `packages/`), copy **`scss.config.example.json`** to **`scss.config.json`** next to it and set **`mergeRoots`** and optional **`contentFiles`** for Tailwind scanning.

See **`web/tailwind/sources.cjs`** for default content and SCSS roots.
