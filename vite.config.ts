import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: "auto",
      registerType: "autoUpdate",

      // vamos usar o nosso próprio service worker customizado
      strategies: "injectManifest",

      // diretório de origem e nome final do arquivo gerado
      srcDir: "src",
      filename: "sw.ts", // arquivo FINAL gerado no build

      injectManifest: {
        // este é o ponto importante 👇
        // caminho EXATO do seu service worker de origem
        swSrc: "src/sw.ts",

        // deixar o plugin cuidar do __WB_MANIFEST, sem injectionPoint manual
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
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
