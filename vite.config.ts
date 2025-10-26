import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // o plugin mesmo vai registrar/atualizar o SW
      injectRegister: "auto",
      registerType: "autoUpdate",

      // usamos nosso próprio service worker customizado
      strategies: "injectManifest",

      // de onde ele lê o SW de origem, e como ele gera o final
      srcDir: "src",
      filename: "sw.js", // <- IMPORTANTÍSSIMO: saída final em JS válido

      injectManifest: {
        // este é o arquivo fonte (TypeScript) que você mantém no repo
        swSrc: "src/sw.ts",

        // arquivos que entram pro precache
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        // aumentar limite pra aceitar bundles grandes
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },

      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html",
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
    }),
  ],
});
