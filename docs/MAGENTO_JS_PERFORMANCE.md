# Fixing Magento 2 JavaScript Performance Without Replatforming to Hyvä

> **TL;DR** — You do not need to rewrite your store in React or migrate to Hyvä to get a fast Magento storefront. The core JS performance problems in Magento Luma are well-understood and fixable in-place. Every technique described in this article is already implemented in the **Win Luna / Tailwind Luna** theme.

---

## The Problem Everyone Blames on "Luma Being Slow"

Run Lighthouse on a stock Magento 2 Luma store and you will see numbers like these:

| Metric | Typical stock Luma |
|--------|-------------------|
| FCP | 2.8 – 4.5 s |
| LCP | 4.0 – 7.0 s |
| TBT | 600 – 1400 ms |
| CLS | 0.05 – 0.2 |

The performance industry's standard advice is: **"Luma is unfixable, migrate to Hyvä."**

This advice is wrong, or at least wildly overstated. Hyvä is an excellent product, but replatforming an established store costs tens or hundreds of thousands of dollars in extension replacements, developer time, and regression risk. Before you sign that invoice, understand *what is actually slow* and whether it can be fixed.

Spoiler: it can.

---

## What Is Actually Causing the Slowness

### 1. RequireJS Bootstrap Blocks All Rendering

This is the single biggest FCP/LCP killer. Here is what the stock Magento HTML looks like at the top of `<body>`:

```html
<script>var require = { baseUrl: '...' };</script>
<script src="requirejs/require.min.js"></script>         <!-- ~70 KB, synchronous -->
<script src="requirejs-min-resolver.min.js"></script>    <!-- synchronous -->
<script src="mage/requirejs/mixins.min.js"></script>     <!-- synchronous -->
<script src="requirejs-config.min.js"></script>          <!-- synchronous -->
```

Four synchronous scripts before a single pixel is painted. The browser must:
1. Stop parsing HTML
2. Download each file (sequentially if not cached)
3. Execute each file
4. Resume HTML parsing

On a cold load over a 4G connection, this costs 400–900 ms of blocked rendering. **This is 100% of your FCP problem.**

### 2. `mage/apply/main` Fires Dozens of `setTimeout(fn, 0)` Back-to-Back

Once RequireJS boots, Magento initializes every UI component on the page through `mage/apply/main.js`. The stock implementation schedules each component with `setTimeout(fn, 0)`. This sounds harmless but is lethal for TBT:

```js
// Magento core — mage/apply/main.js (simplified)
_.each(components, function(component) {
    setTimeout(function() {
        mage.apply(component); // blocks main thread each time
    }, 0);
});
```

With 30–60 components on a typical PDP, you get 30–60 consecutive main-thread tasks, each taking 5–30 ms. Lighthouse measures Total Blocking Time as the sum of every task over 50 ms. The tasks pile up because `setTimeout(0)` queues them all at the same priority, yielding nothing to the browser between calls.

### 3. Knockout.js `applyBindings` Is Synchronous and Greedy

Magento's `ko.applyBindings()` walks the entire DOM, evaluates every `data-bind` expression, and subscribes observables. On a page with a minicart, customer section, and product swatches, this single call can block the main thread for 80–200 ms.

It runs immediately after RequireJS boots — exactly during the FCP window.

### 4. JS Bundling Makes Everything Worse, Not Better

Magento has a built-in JS bundler. The intention is to reduce HTTP requests. In practice it creates 2–5 MB synchronous bundles that block the main thread for 800–1400 ms. We measured **940 ms TBT** with bundling enabled on a PDP. With bundling disabled: **~180 ms TBT**.

Do not enable Magento's built-in JS bundler.

### 5. Unused CSS from Blank/Luma Theme (~800 KB)

Stock Luma ships `styles-m.css` (~400 KB) and `styles-l.css` (~350 KB). These load on every page. Most rules are never used because the Tailwind approach generates only what the templates actually reference. Shipping 750 KB of unused CSS is a significant render-blocking cost.

---

## The Fixes — All Already in Win Luna / Tailwind Luna

### Fix 1: Remove the Unused Luma CSS Entirely

In `Magento_Theme/layout/default_head_blocks.xml`:

```xml
<head>
    <remove src="css/styles-m.css"/>
    <remove src="css/styles-l.css"/>
    <remove src="css/print.css"/>
    <remove src="fonts/opensans/light/opensans-300.woff2"/>
    <remove src="fonts/opensans/regular/opensans-400.woff2"/>
    <remove src="fonts/opensans/semibold/opensans-600.woff2"/>
    <remove src="fonts/opensans/bold/opensans-700.woff2"/>
    <remove src="fonts/Luma-Icons.woff2"/>
    <remove src="mage/calendar.css"/>
</head>
```

Replace with a single Tailwind-compiled stylesheet (~107 KB minified vs ~750 KB). This alone reduces render-blocking CSS weight by **85%**.

### Fix 2: Replace `mage/apply/main` with `requestIdleCallback`

Create `Magento_Theme/web/js/mage-apply-main-perf.js`:

```js
define(['mage/apply/main'], function (mageApply) {
    'use strict';

    // Escape hatch: window.gphpDeferMageApply = false disables this override
    if (window.gphpDeferMageApply === false) {
        return mageApply;
    }

    var originalRun = mageApply.run.bind(mageApply);

    mageApply.run = function () {
        var args = arguments;
        var schedule = window.requestIdleCallback
            ? function (fn) { requestIdleCallback(fn, { timeout: 2000 }); }
            : function (fn) { setTimeout(fn, 0); };

        schedule(function () {
            originalRun.apply(mageApply, args);
        });
    };

    return mageApply;
});
```

Map it as a drop-in replacement in `requirejs-config.js`:

```js
var config = {
    map: {
        '*': {
            'mage/apply/main': 'Magento_Theme/js/mage-apply-main-perf'
        }
    }
};
```

`requestIdleCallback` with `timeout: 2000` tells the browser: *"Run this when you have spare time, but no later than 2 seconds from now."* The browser can now paint the LCP element, handle user input, and run layout — then come back to initialize components. TBT drops dramatically because no single idle callback can block the main thread for long; the browser interleaves them with rendering frames.

### Fix 3: Defer Knockout `applyBindings`

Create `Magento_Theme/web/js/ko-apply-bindings-patch.js`:

```js
define(['ko'], function (ko) {
    'use strict';

    var original = ko.applyBindings.bind(ko);
    var schedule = window.requestIdleCallback
        ? function (fn) { requestIdleCallback(fn, { timeout: 2000 }); }
        : function (fn) { setTimeout(fn, 0); };

    ko.applyBindings = function (viewModel, node) {
        // Bindings on <body> or no node: defer to idle — these are the expensive global scans
        if (!node || node === document.body) {
            schedule(function () { original(viewModel, node); });
            return;
        }
        // Scoped bindings (minicart, widget containers): run immediately
        original(viewModel, node);
    };

    return ko;
});
```

Global `ko.applyBindings()` calls — the expensive ones that scan the whole document — are deferred to idle time. Scoped calls (a specific widget container) run immediately since they are fast.

### Fix 4: Move Non-Bootstrap Scripts to End of HTML

A PHP observer (`DeferJsObserver`) intercepts `http_response_send_before`, walks the HTML body, and moves every external `<script>` that is **not** part of the RequireJS bootstrap to the end of the document:

```
Bootstrap chain stays in place:
  require.min.js, requirejs-min-resolver, mixins, requirejs-config

Everything else (analytics, chat widgets, social SDKs) moves to after </html>:
  gtag.js, fbq, Intercom, etc.
```

The observer is aware of `no-defer` attribute if you need to exempt a specific script:

```html
<script src="critical-widget.js" no-defer></script>
```

It also skips non-HTML responses (AJAX, JSON) entirely via a Content-Type guard, avoiding expensive regex on API calls.

### Fix 5: Disable JS Bundling, Enable Minification

In `app/etc/env.php`:

```php
'dev' => [
    'js' => [
        'move_script_to_bottom' => '1',
        'merge_files'           => '0',
        'enable_js_bundling'    => '0',   // NEVER enable — 940 ms TBT measured
        'minify_files'          => '1',   // DO enable — ~30% size reduction
    ],
    'css' => [
        'merge_css_files' => '0',
    ],
],
```

Bundling was tested, measured at 940 ms TBT on a PDP (Lighthouse red), and permanently disabled. Minification is kept on — it reduces payload without any execution penalty.

---

## The Results

After applying all fixes in the Win Luna theme on a real Magento 2.4 store:

| Metric | Stock Luma | Win Luna |
|--------|-----------|----------|
| FCP | ~3.5 s | ~0.9 s |
| LCP | ~5.5 s | ~1.8 s |
| TBT | ~940 ms | ~120 ms |
| CSS payload | ~750 KB | ~107 KB |
| Render-blocking JS | 4 sync scripts | 4 sync scripts* |

*RequireJS bootstrap cannot be deferred — Magento's architecture requires it. The gains come from not blocking anything else and spreading component initialization across idle time.

---

## What Hyvä Actually Solves (And What It Doesn't)

To be fair: Hyvä's architectural advantage is that it **eliminates RequireJS and Knockout entirely**, replacing them with Alpine.js and plain ES modules. There is no AMD loader bootstrap. There is no global `applyBindings` scan. That is a genuine structural win that cannot be fully replicated with patching.

However:

- Hyvä requires replacing every third-party module that touches the frontend. For a store with 20+ extensions this is a 6–18 month project.
- The performance gap between a well-optimized Luma theme and Hyvä is **much smaller** than the migration cost suggests — particularly once RequireJS is preloaded and component init is deferred.
- Hyvä's compatibility module (`hyva-compat`) often reintroduces RequireJS anyway for extensions that haven't been ported.

If you are starting a new store: Hyvä is worth considering. If you have a running store with real customers and revenue: fix Luma first. You will get 80% of the performance gains for 5% of the cost.

---

## Getting Win Luna

The Win Luna / Tailwind Luna theme packages all of these fixes — `mage-apply-main-perf`, the KO bindings patch, `DeferJsObserver`, the CSS removal, and the Tailwind build pipeline — into a single Magento 2 Composer theme that installs on top of Blank without replacing your existing checkout or extension templates.

Repository: [Genaker/Tailwind-Luna](https://github.com/Genaker/Tailwind-Luna)

---

## Checklist

- [ ] Remove `styles-m.css`, `styles-l.css`, unused fonts
- [ ] Replace with single Tailwind-compiled stylesheet
- [ ] Patch `mage/apply/main` to use `requestIdleCallback`
- [ ] Defer global `ko.applyBindings` calls
- [ ] Move non-bootstrap scripts to end of document via observer
- [ ] Disable JS bundling (`enable_js_bundling = 0`)
- [ ] Enable JS minification (`minify_files = 1`)
- [ ] Verify Content-Type guard on DeferJs observer (skip AJAX responses)
- [ ] Check Lighthouse accessibility: `sr-only` on visually-hidden labels, not `hidden`

---

## See also

- **[MICROFRONTEND_REACT_LUMA.md](MICROFRONTEND_REACT_LUMA.md)** — microfrontend architecture, **[React Luma](https://github.com/Genaker/reactmagento2)**, and **gogento / nodegento / pygento** patterns for fast backends beside Magento.
- **[CLOUDFLARE_FPC_WORKER.md](CLOUDFLARE_FPC_WORKER.md)** — **[Cloudflare Worker FPC](https://github.com/Genaker/CloudFlare_FPC_Worker)** edge cache; pairs with Luma + this theme for CDN-side HTML offload.
