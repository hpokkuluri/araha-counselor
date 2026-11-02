import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Project site: https://hpokkuluri.github.io/araha-counselor/
// For a custom domain at the root, build with VITE_BASE=/
const base = process.env.VITE_BASE || "/araha-counselor/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: [
        "favicon.svg",
        "fonts/*.woff2",
        "fonts/*.ttf",
        "icons/*.png",
      ],
      manifest: {
        name: "Araha Counselor",
        short_name: "Counselor",
        description: "Private, offline student counselor by Arahasoft. Your data stays on this device.",
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
