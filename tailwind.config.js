/** @type {import('tailwindcss').Config} */
const fs = require("fs");
const path = require("path");
const { contentFiles } = require("./web/tailwind/sources.cjs");

const contentRootsPath = path.join(__dirname, "web", "tailwind", "_content-roots.json");
let extraFromConfig = [];
if (fs.existsSync(contentRootsPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(contentRootsPath, "utf8"));
    extraFromConfig = Array.isArray(parsed.files) ? parsed.files : [];
  } catch (_) {
    /* ignore */
  }
}

module.exports = {
  content: {
    files: [...contentFiles, ...extraFromConfig],
    transform: {
      phtml: (src) => src.replace(/<\?php[\s\S]*?\?>/g, ""),
      scss: (src) => src,
    },
  },
  corePlugins: {
    preflight: true,
  },
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1979c3",
          hover: "#166aaf",
          dark: "#135a91",
        },
        accent: "#f89b29",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "Noto Sans",
          "sans-serif",
        ],
      },
      maxWidth: {
        layout: "1280px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [],
};
