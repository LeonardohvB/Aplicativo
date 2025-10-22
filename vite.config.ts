import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Vite 5 + vite-plugin-pwa 1.x using injectManifest with src/sw.ts
export default defineConfig({
  plugins: [
    react(),

    VitePWA({
  injectRegister: "auto",
  registerType: "autoUpdate",
  strategies: "injectManifest",
  srcDir: "src",
  filename: "sw.ts",
  injectManifest: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
  },
  devOptions: { enabled: true, type: "module", navigateFallback: "index.html" },

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
      // se quiser máscara: use o mesmo 512 até ter um "maskable" dedicado
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable any" }
    ]
  }
})

  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
          lucide: ["lucide-react"],
        },
      },
    },
  },

  optimizeDeps: {
    // lucide-react é ESM; excluir pode evitar pre-bundle chato
    exclude: ["lucide-react"],
  },
});
