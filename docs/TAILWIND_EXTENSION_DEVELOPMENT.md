# Tailwind in Magento extensions — development guide

This guide explains how to use **Tailwind Luna** with **new** and **existing** frontend extensions, when to migrate styles, and when **not** to use Tailwind (plain CSS, layout, inline).

The **compiled** stylesheet is **`web/css/tailwind.css`** in the theme package. It is built with **npm** from this theme (`npm run build:tailwind`). Extensions do not run Tailwind themselves; they **contribute** SCSS and **markup** that the theme build picks up.

---

## 1. How styling fits together

| Approach | Best for | Notes |
|----------|----------|--------|
| **Utility classes in `.phtml` / layout XML** | New UI, rapid iteration | Tailwind **JIT** scans your templates (see `contentFiles` in `web/tailwind/sources.cjs`). Add classes → run **`npm run build:tailwind`** in the theme. |
| **Module SCSS under `view/frontend/web/tailwind/`** | Component-scoped rules, `@apply`, variables, `@layer` | Picked up by **`merge-scss.cjs`** and compiled into **`_merged.css`** for paths under **`vendor/magento/module-*`**, **`app/code/*/*`**, and **`src/**`**. Optional **`scss.config.json`** in that folder: **`mergeRoots`**, **`exclude`**, **`tier`**, **`contentFiles`** (see [CSS_MERGE.md](./CSS_MERGE.md)). |
| **Plain CSS file + layout** | Legacy bundles, third-party CSS, one-off pages | Add **`web/css/foo.css`** in the module and reference it from layout XML (`<css src="Vendor_Module::css/foo.css"/>`). No Tailwind build required. |
| **Inline `style=""` / `<style>` block** | Quick fixes, dynamic values, admin previews | Valid escape hatch; keep tiny and intentional (cache, CSP, and maintainability). |

You can mix all of these in one project. Migration is usually **incremental**: leave old CSS loading until you replace it.

---

## 2. New extension (greenfield)

### 2.1 Markup and Tailwind utilities

1. Create your module under **`app/code/Vendor/Module/`** (or Composer package).
2. Put storefront templates under **`view/frontend/templates/`** and layouts under **`view/frontend/layout/`**.
3. Use **Tailwind utility classes** in `class=""` attributes and **`htmlClass`** in layout XML — same as core.

The theme’s **`tailwind.config.js`** loads **`contentFiles`** from **`sources.cjs`**, which already includes:

- `../../app/code/*/*/view/frontend/templates/**/*.phtml`
- `../../app/code/*/*/view/frontend/layout/**/*.xml`

So new `app/code` modules are scanned **without** editing the theme.

4. From the **theme** directory, run:

   ```bash
   cd packages/theme-frontend-win-luna
   npm run build:tailwind
   ```

5. Deploy / flush cache as you normally do.

### 2.2 Module SCSS (optional but recommended for non-trivial CSS)

Create files under:

```text
app/code/Vendor/Module/view/frontend/web/tailwind/
  _module.scss   # or any *.scss
```

Paths are merged in **sorted order** with the rest of the theme. Use **`@layer`**, **`@apply`**, and SCSS features; see [CSS_MERGE.md](./CSS_MERGE.md).

**Composer-installed** packages under **`vendor/magento/module-*/`** use the same folder layout:

```text
vendor/magento/module-foo/view/frontend/web/tailwind/*.scss
```

**Monorepo `src/`** trees:

```text
src/YourPackage/view/frontend/web/tailwind/*.scss
```

### 2.3 If your code lives outside those globs

In the theme, add **`web/tailwind/scss.config.json`** (see **`scss.config.example.json`**):

- **`mergeRoots`** — extra directories to merge as `**/*.scss`.
- **`contentFiles`** — extra globs so Tailwind JIT sees your templates.

---

## 3. Old extension (migration guide)

“Old” here means: **LESS/CSS** in `web/css`, **`_module.less`**, layout references to **`styles-m.css`**, inline BEM, or heavy custom files — not necessarily bad, just pre–Tailwind Luna.

### Phase A — No file moves (safest)

1. Keep existing **layout `<css src="..."/>`** entries and **static CSS** as they are.
2. In **new** or **edited** templates only, add **Tailwind utility classes** alongside existing classes (Magento often merges `class` via helpers; test your blocks).
3. Run **`npm run build:tailwind`** so new utilities appear in **`tailwind.css`**.
4. Gradually **delete** obsolete rules from old CSS files when nothing relies on them.

**Pros:** Low risk, no big-bang. **Cons:** Two styling systems until you finish.

### Phase B — Move “component” styles into Tailwind merge

1. Copy or rewrite critical rules into **`view/frontend/web/tailwind/*.scss`** in the same module (see §2.2).
2. Remove duplicate rules from legacy **`web/css/*.css`** when safe.
3. Optionally remove redundant **`<css>`** entries from layout XML once **`tailwind.css`** covers the same UI.

### Phase C — Drop LESS (if you still use it)

Magento’s LESS compilation is separate from this theme’s pipeline. For extensions:

- Prefer **plain CSS** or **SCSS** in **`web/tailwind/`** (merged build) or **plain `web/css/*.css`** (static file).
- Remove **`_module.less`** references from **`module.xml` / theme inheritance** per Magento docs; this is project-specific.

### Vendor / core modules you do not own

- Prefer **theme-level overrides** (`app/design/frontend/...`) for templates and layout.
- For CSS-only contributions without forking: **`web/tailwind/extensions/*.scss`** in the **theme** package, or **`scss.config.json`** **`mergeRoots`** pointing at a path inside your own module.

---

## 4. Raw CSS without Tailwind (layout, static files)

You do **not** have to put everything into Tailwind.

### 4.1 Layout XML — register a stylesheet

```xml
<head>
    <css src="Vendor_Module::css/my-legacy.css"/>
</head>
```

Place the file at:

```text
app/code/Vendor/Module/view/frontend/web/css/my-legacy.css
```

Magento publishes it under **`pub/static`** on deploy. This is ideal for **third-party** CSS, **print** rules, or **temporary** bridges during migration.

### 4.2 Page-layout / default head blocks

You can use the same **`<css src="..."/>`** pattern in `default.xml`, checkout handles, etc. Order matters: use **`order`** attribute if you need cascade control.

### 4.3 Inline styles

- **`style="..."`** on an element — fine for **one-off** or **dynamic** values (e.g. width from PHP).
- **`<style>...</style>`** in a template — use sparingly; prefer a file for anything large.

CSP and future maintenance: prefer classes + Tailwind or a static CSS file when possible.

---

## 5. Classes the scanner cannot see

If classes are built only in **JavaScript** or concatenated in a way the scanner misses, use **`web/tailwind/css-safelist.html`** or **`contentFiles`** in **`scss.config.json`**. See **[TAILWIND_CSS_SAFELIST.md](./TAILWIND_CSS_SAFELIST.md)**.

---

## 6. Checklist after you change an extension

| Change | Action |
|--------|--------|
| New/changed **`.phtml` / `.xml`** classes | `npm run build:tailwind` (theme dir) |
| New/changed **`view/frontend/web/tailwind/*.scss`** | `npm run build:tailwind` |
| Only **`web/css/*.css`** static file (layout-loaded) | Deploy static / flush cache; **no** npm |
| New module **outside** default `content` globs | Add **`contentFiles`** in **`scss.config.json`** |

---

## 7. Related documentation

- [CSS_BUILD_ARCHITECTURE.md](./CSS_BUILD_ARCHITECTURE.md) — pipeline overview.
- [CSS_MERGE.md](./CSS_MERGE.md) — merge order and `scss.config.json`.
- [TAILWIND_CSS_SAFELIST.md](./TAILWIND_CSS_SAFELIST.md) — safelist.

---

## Summary

- **New extensions:** use **utilities in templates** + optional **`web/tailwind/*.scss`** in the module; run **`build:tailwind`** from the theme.
- **Old extensions:** migrate in **phases**; keep **layout + raw CSS** as long as needed.
- **You can always** ship **plain CSS** via **`web/css`** and **layout XML**, or use **inline** styles for small or dynamic cases — no Tailwind build required for those paths.
