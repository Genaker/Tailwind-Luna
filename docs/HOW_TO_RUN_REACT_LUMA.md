# How to Install and Run Tailwind Luna (React Luma) with Warden

## Prerequisites
- Docker installed and running
- Warden installed (see https://warden.dev/)
- Node.js (v20+) and npm
- (Optional) WardenGUI: `pip install wardengui` or `curl -sSL https://raw.githubusercontent.com/Genaker/WardenGUI/main/install.sh | bash`

## 1. Clone the Repository
```bash
git clone https://github.com/Genaker/Tailwind-Luna.git
cd Tailwind-Luna
```

## 2. Prepare Warden Environment Files
```bash
mkdir -p .warden
cp warden/warden-env.yml .warden/warden-env.yml
cp warden/env.warden.example .env
# If .env exists, merge only the needed variables
```

## 3. Install Node.js Dependencies
```bash
npm install
```
If you see warnings about deprecated packages or vulnerabilities, run:
```bash
npm audit fix
```

## 4. Build Tailwind CSS
```bash
npm run build:tailwind
```

## 5. Initialize and Start Warden
```bash
warden env-init luma magento2
warden sign-certificate
warden up
```
- Default URL: https://app.luma.test (adjust `.env` if needed)

## 6. (Optional) Use WardenGUI
```bash
wardengui
# or to start the environment directly:
wardengui luma start
```

## 7. Build/Deploy React Luma
See https://github.com/Genaker/Luma-React-PWA-Magento-Theme for setup. You can run React Luma as a separate frontend, pointing it at your Warden Magento backend.

## 8. Troubleshooting
- If `wardengui: command not found`, add `~/.local/bin` to your `PATH` or use `python3 -m wardengui`.
- If Docker or Warden commands fail, ensure Docker Desktop is running and Warden is installed in `/opt/warden/bin/warden`.
- For CSS build errors, ensure Node.js is v20+ and run `npm install` again.

## 9. Useful Commands
- `warden shell` — open a shell in the Magento container
- `npm run build:tailwind` — rebuild CSS after changes
- `php bin/magento setup:static-content:deploy -f` — deploy static content
- `php bin/magento cache:flush` — flush Magento cache

---

**Issues found and fixed:**
- Two npm vulnerabilities (brace-expansion, picomatch) were auto-fixed with `npm audit fix`.
- Tailwind CSS build completed successfully.
- All required environment files were created and populated.

You can now run and develop with Tailwind Luna and React Luma on your local Magento stack using Warden.
