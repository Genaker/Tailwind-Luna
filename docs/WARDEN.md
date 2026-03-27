# Running Tailwind Luna with [Warden](https://warden.dev/)

Magento is served by **Docker** via **Warden**. This theme’s **CSS build** runs **on the host** (Node) or **inside** `warden shell` — both work if Node/npm are available.

## [WardenGUI](https://github.com/Genaker/WardenGUI) (optional CLI / TUI)

[WardenGUI](https://github.com/Genaker/WardenGUI) is a **terminal UI + headless CLI** for switching between Warden projects, starting environments, **`warden shell`**, logs, and URLs. It expects **Warden** at **`/opt/warden/bin/warden`**, **Docker** running, and projects that have **`.warden/`** plus **`.env`** with **`WARDEN_ENV_NAME`** (see the [upstream README](https://github.com/Genaker/WardenGUI/blob/main/README.md)).

### Install WardenGUI

**PyPI:**

```bash
pip install wardengui
# or: pip3 install --user wardengui
```

**One-liner from GitHub:**

```bash
curl -sSL https://raw.githubusercontent.com/Genaker/WardenGUI/main/install.sh | bash
```

If **`wardengui: command not found`**, add **`~/.local/bin`** to **`PATH`** or run **`python3 -m wardengui`** ([troubleshooting](https://github.com/Genaker/WardenGUI/blob/main/README.md#troubleshooting-command-not-found)).

### Point it at this Magento / monorepo

WardenGUI scans a **projects root** (default **`~`**) for folders containing **`.warden`**. After [One-time install](#one-time-install-new-clone) below, your Magento root (e.g. **`~/luma`**) should qualify.

If the repo is nested, use **`wardengui -p /path/to/parent`** so the directory that **contains** your project is scanned. Match **`WARDEN_ENV_NAME`** in **`.env`** to the name in headless commands (e.g. **`luma`**).

### Useful commands

```bash
wardengui                    # interactive menu
wardengui luma start         # start env (stops other env if configured)
wardengui luma info          # URL, e.g. https://app.luma.test
wardengui luma ssh           # same as warden shell in that project
```

## Where Warden expects files

Warden reads the **Magento project root** (the directory that contains `composer.json`, `bin/magento`, and `app/`).

| Path | Purpose |
|------|---------|
| **`<magento-root>/.env`** | Warden variables (`WARDEN_ENV_TYPE`, `TRAEFIK_DOMAIN`, PHP/MySQL versions, etc.). |
| **`<magento-root>/.warden/warden-env.yml`** | Optional overrides (e.g. Traefik rules for Varnish). |

**Tracked source of truth** in this repository lives under the theme package:

`packages/theme-frontend-win-luna/warden/`

- **`warden/warden-env.yml`** → copy to `<magento-root>/.warden/warden-env.yml`
- **`warden/env.warden.example`** → copy to `<magento-root>/.env` (or merge keys you need)

If your checkout already has `.env` / `.warden`, compare with these files when upgrading or reproducing the stack.

### One-time install (new clone)

From **Magento root** (replace paths if your project is not named `luma`):

```bash
cd /path/to/magento   # e.g. ~/luma or your monorepo root

mkdir -p .warden
cp packages/theme-frontend-win-luna/warden/warden-env.yml .warden/warden-env.yml
cp packages/theme-frontend-win-luna/warden/env.warden.example .env
```

If **`.env` already exists**, merge only the variables you need from **`env.warden.example`** (e.g. `PHP_VERSION`, `TRAEFIK_DOMAIN`).

Then install Warden (see [warden.dev](https://warden.dev/)) and start the stack:

```bash
warden env-init luma magento2
# If you already ran env-init, skip or align WARDEN_ENV_NAME with your .env

warden sign-certificate
warden up
```

Default URL in this template: **`https://app.luma.test`** (`TRAEFIK_SUBDOMAIN=app`, `TRAEFIK_DOMAIN=luma.test`). Adjust hosts in `.env` if your domain differs.

## Magento inside the container

```bash
warden shell
cd /var/www/html   # Web root inside Warden (Magento root)
php bin/magento --version
```

Composer installs and `bin/magento setup:upgrade` are usually run here (or from host with `warden env exec`).

## Tailwind Luna (CSS build)

From **Magento root** or **theme package**:

```bash
cd packages/theme-frontend-win-luna
npm install
npm run build:tailwind
```

You can run the same **`npm run …`** commands inside **`warden shell`** if Node is installed in the PHP image (see `NODE_VERSION` in `.env`). Many teams run **Node on the host** for faster Tailwind builds.

After deploy:

```bash
warden shell
php bin/magento setup:static-content:deploy -f
php bin/magento cache:flush
```

## E2E / Playwright

Point Playwright at the Warden URL:

```bash
export PLAYWRIGHT_BASE_URL=https://app.luma.test
cd packages/theme-frontend-win-luna
npm run test:e2e
```

See **`e2e/README.md`** for credentials and PHP helpers.

## Related

- [README.md](../README.md) — **Refresh CSS** and **Build** (`npm run build:tailwind`).
- [CSS_BUILD_ARCHITECTURE.md](./CSS_BUILD_ARCHITECTURE.md) — Tailwind pipeline.
