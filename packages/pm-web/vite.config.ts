import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8"));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "GMD Projects",
        short_name: "GMD PM",
        theme_color: "#000000",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
        shortcuts: [
          { name: "Projelerim", short_name: "Projeler", description: "Proje listesi", url: "/projects" },
          { name: "Görevlerim", short_name: "Görevler", description: "GMD günlük görevler", url: "https://gmd.byfeb.com/" },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../web/src"),
    },
  },
  publicDir: path.resolve(__dirname, "../web/public"),
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
