import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8"));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:3001";

  return {
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "GitMyDayTime",
        short_name: "GMD",
        id: "/",
        scope: "/",
        description: "Track daily plans, duties, notes, and time.",
        theme_color: "#000000",
        background_color: "#f5f5f7",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        orientation: "portrait-primary",
        categories: ["productivity", "lifestyle"],
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        shortcuts: [
          { name: "Bugün", short_name: "Bugün", description: "Bugünkü planı aç", url: "/" },
          { name: "Hızlı Ekle", short_name: "Ekle", description: "Yeni görev ekle", url: "/?quickAdd=1" },
          { name: "Haftalık", short_name: "Hafta", description: "Haftalık görünüm", url: "/week" },
          { name: "İstatistikler", short_name: "Stats", description: "İstatistikler", url: "/stats" },
        ],
        share_target: {
          action: "/?share=1",
          method: "GET",
          params: { title: "title", text: "text", url: "url" },
        },
      },
      workbox: {
        importScripts: ["/sw-push.js"],
        runtimeCaching: [
          {
            // All API requests always go to network — never cache
            // Using a function so workbox matches ALL methods (not just GET)
            // and checks pathname instead of full URL (regex can't match full URL)
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: "",
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            const setCookie = proxyRes.headers["set-cookie"];
            if (!setCookie) return;

            proxyRes.headers["set-cookie"] = setCookie.map((cookie) =>
              cookie
                .replace(/;\s*Domain=[^;]*/gi, "")
                .replace(/;\s*Secure/gi, "")
            );
          });
        },
      },
    },
    allowedHosts: ["phirios"]
  },
  };
});
