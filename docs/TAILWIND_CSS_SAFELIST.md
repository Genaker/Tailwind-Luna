# Global Tailwind CSS safelist

## What it is

**`web/tailwind/css-safelist.html`** is a **build-only** file. It is **not** part of the Magento storefront output. Tailwind’s JIT reads it so utilities that **never appear** in scanned `.phtml` / `.xml` / `.html` still get generated into **`web/css/tailwind.css`**.

## Why we need it

In **`tailwind.config.js`**, PHTML files use a **transform** that removes every `<?php … ?>` block before scanning:

```js
transform: {
  phtml: (src) => src.replace(/<\?php[\s\S]*?\?>/g, ""),
},
```

That avoids parse noise from PHP, but it also means:

- Class strings **only inside PHP** (variables, `getHtml()` arguments, `escapeHtmlAttr`, Knockout `dialogClass` in JSON, etc.) are **invisible** to Tailwind.
- Any utility you add **only** there will **not** appear in the compiled CSS until you **duplicate** it in the safelist (or move it to static HTML in a template).

Static `class="…"` in PHTML (with no PHP inside the attribute) **is** scanned normally — no safelist entry needed.

## What lives in `css-safelist.html`

The file is one HTML page with **sections** (see comments inside it):

| Section      | Purpose |
|-------------|---------|
| **Shell / layout** | Utility combos used on wrappers (and historically from layout); keeps layout-related classes available if referenced from non-scanned sources. |
| **Minicart dialog** | `dialogClass` / dialog options built in JS or not present as plain `class` on an element the scanner sees. |
| **Topmenu getHtml** | Must stay in sync with **`$menuTopLinkClasses`** and **`$menuSubmenuClasses`** in **`Magento_Theme/templates/html/topmenu.phtml`**. |
| **Custom** | Add new hidden `<div class="hidden …">` rows for any other “hidden” utility sources. |

### PDP (`catalog_product_view.xml`) — Magento `htmlClass` tokens

Core defines **`product media`** and **`product-info-main`** on `product.info.media` / `product.info.main`. A theme `referenceContainer` **htmlClass** becomes the final attribute for that container, so **`Magento_Catalog/layout/catalog_product_view.xml`** repeats those **exact** strings **first**, then appends Tailwind. Do not drop or rename them — JS, samples, and third-party extensions often target these class names.

Each safelist row is typically:

```html
<div aria-hidden="true" class="hidden …all utilities…"></div>
```

Use **`hidden`** so the element is inert if the file were ever accidentally opened in a browser.

## Workflow

1. You add or change Tailwind classes that live **only in PHP / JSON / JS**.
2. Append or update the matching string under the right **section** in **`web/tailwind/css-safelist.html`**.
3. Run **`npm run build:tailwind`** from the theme directory.
4. Deploy static content / flush Magento cache as you usually do.

**Topmenu:** after editing **`topmenu.phtml`** class variables, **always** paste the new strings into the **Topmenu** section of **`css-safelist.html`**.

## Single source of truth

- **Appearance** for menu links / submenus: **`topmenu.phtml`** (variables) + **mirror** in **`css-safelist.html`** for JIT.
- **Runtime behavior** (e.g. flyout `display`, `nav-open`): still in **`web/tailwind/input.css`** where selectors must target Magento / jQuery UI markup.

## See also

- Theme **`README.md`** — Styles / Tailwind overview.
- **`Magento_Theme/templates/html/topmenu.phtml`** — docblock explains the menu + safelist link.
