import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: "auto",
      registerType: "autoUpdate",

      // 👇 VOLTAMOS PARA generateSW
      strategies: "generateSW",

      // se quiser cachear mais coisas, põe aqui
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },

      manifest: {
        name: "Sistema de Gestão",
        short_name: "Gestão",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f9fafb",
        theme_color: "#0b0b0f",
        description: "PWA de gestão clínica",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable any",
          },
        ],
      },

      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html",
      },
    }),
  ],
});
