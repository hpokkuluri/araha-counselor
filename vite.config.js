import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Project site: https://hpokkuluri.github.io/araha-counselor/
// For a custom domain at the root, build with VITE_BASE=/
const base = process.env.VITE_BASE || "/araha-counselor/";

const builtAt = new Date().toISOString();

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "2.0.0"),
    __BUILD_TIME__: JSON.stringify(builtAt),
  },
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: [
        "favicon.svg",
        "fonts/*.woff2",
        "fonts/*.ttf",
        "icons/*.png",
      ],
      manifest: {
        name: "ARAHA Counselor",
        short_name: "ARAHA Counselor",
        description: "ARAHA Counselor 2.0. Private, offline student counselor by Arahasoft. Your data stays on this device.",
        theme_color: "#0E1B3D",
        background_color: "#0E1B3D",
        display: "standalone",
        start_url: "./",
        scope: "./",
        id: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ttf,ico,webmanifest}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: "index.html",
        // Model weights are fetched from the public model host and cached by WebLLM, not by this worker.
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
});
