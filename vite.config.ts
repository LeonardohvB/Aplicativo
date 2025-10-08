import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // ✅ evita warnings e garante que o próprio SW não entre no cache
        globIgnores: ['**/node_modules/**/*', '**/sw.js', '**/workbox-*.js'],
        // ✅ corrige o erro do Vercel (limite padrão é 2 MiB)
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // opcional: não tenta fallback para rotas de API
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Aplicativo',
        short_name: 'Aplicativo',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  build: {
    // apenas reduz o aviso do tamanho (não afeta o erro do PWA)
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // 🔪 separa libs pesadas em chunks próprios
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          lucide: ['lucide-react'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
})
