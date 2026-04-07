# Cloudflare Worker FPC (edge full-page cache)

This document describes how **[Cloudflare Worker FPC](https://github.com/Genaker/CloudFlare_FPC_Worker)** fits **on top of** a classic Magento 2 + **Tailwind Luna** stack ([theme source](https://github.com/Genaker/Tailwind-Luna)): an **edge** full-page cache layer on Cloudflare’s CDN, **without** replacing Magento Luma with a proprietary theme (for example **Hyvä**). The worker is **not** part of this theme package; it is a separate open-source project you deploy to your Cloudflare account.

---

## What it is

The **[CloudFlare_FPC_Worker](https://github.com/Genaker/CloudFlare_FPC_Worker)** project implements a **Cloudflare Worker** that:

- Intercepts **GET** requests and serves **cached HTML** (or cacheable API responses) from the **edge** when possible.
- Uses **KV** (Workers KV) for **cache version** and global settings — soft purge by bumping version, async revalidation against origin.
- Is designed to work **with** Magento’s own caching (PHP built-in FPC, **[FastFPC](https://github.com/Genaker/FastFPC)**, **Varnish**, etc.), not to replace every invalidation rule Magento already has.

Upstream describes goals such as **high edge cache hit rates**, **stale-while-revalidate** behavior, optional **R2 / Cache Reserve** integration in advanced setups, and **query-string controls** for debugging (`cfw=false`, revalidate, purge helpers — see the **[upstream README](https://github.com/Genaker/CloudFlare_FPC_Worker)**).

**License:** upstream is **GPL-3.0** — follow the repository for terms.

---

## How it pairs with Tailwind Luna

| Layer | Role |
|--------|------|
| **Tailwind Luna** (this theme) | Lean **CSS**, Luma-compatible templates, optional **Tailwind** build pipeline. |
| **React Luma** (optional module) | **JS** delivery and optional React/Vue islands — see **[MICROFRONTEND_REACT_LUMA.md](MICROFRONTEND_REACT_LUMA.md)**. |
| **Magento origin** | Real cart, checkout, customer session, admin — **system of record**. |
| **Cloudflare Worker FPC** | **CDN edge** HTML/API cache — fewer round-trips to origin for anonymous/cacheable pages. |

You can pursue **strong Core Web Vitals and origin offload** by combining **theme + JS optimizations + edge FPC**, instead of a **full storefront replatform** to another theme vendor.

---

## Deployment (high level)

The **[CloudFlare_FPC_Worker](https://github.com/Genaker/CloudFlare_FPC_Worker)** repository documents:

- **Dashboard** deploy (clone from Git, KV binding, route `*yoursite.com/*`).
- **Wrangler** CLI (`wrangler.toml`, `npx wrangler deploy`).
- **Terraform**, **Docker**-based tests, and **Jest** / **Vitest** integration tests.

**Binding name** for KV in the worker is typically **`KV`** (see upstream **DEPLOY.md** / README). **Environment variables** often use an **`ENV_`** prefix in the dashboard.

Operational practices (cache rules for `/static/` and `/media/`, Cache Reserve costs, etc.) are described in the **upstream README** — treat that as the source of truth; this file only **links** the architecture to Tailwind Luna.

---

## When this is a better fit than “replace the whole theme”

- You need **faster TTFB globally** and **higher cache hit ratio** at the **edge**.
- You want to **keep** Luma-compatible extensions and **incremental** theme work (**Tailwind Luna**).
- You **do not** want to budget a **Hyvä-scale migration** (templates, Alpine, checkout productization, extension matrix).

Edge FPC does **not** remove the need for **good CSS and JS** on the origin — it **amplifies** the benefit once pages are cacheable and headers cooperate.

---

## References

- **Tailwind Luna (this theme):** [https://github.com/Genaker/Tailwind-Luna](https://github.com/Genaker/Tailwind-Luna)
- **Cloudflare Worker FPC (open source):** [https://github.com/Genaker/CloudFlare_FPC_Worker](https://github.com/Genaker/CloudFlare_FPC_Worker)
- **In-store JS tuning (Luma):** [MAGENTO_JS_PERFORMANCE.md](MAGENTO_JS_PERFORMANCE.md)
- **React Luma + microfrontends:** [MICROFRONTEND_REACT_LUMA.md](MICROFRONTEND_REACT_LUMA.md)
