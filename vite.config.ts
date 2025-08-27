import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // ✅ evita warnings e garante que o próprio SW não entre no cache
        globIgnores: [
          '**/node_modules/**/*',
          '**/sw.js',
          '**/workbox-*.js'
        ]
      },
      devOptions: { enabled: true },
      registerType: 'autoUpdate',
      manifest: {
        name: 'Aplicativo',
        short_name: 'Aplicativo',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
})
