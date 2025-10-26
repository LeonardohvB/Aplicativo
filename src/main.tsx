import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import 'animate.css';

// --- registro via vite-plugin-pwa (auto update) ---
if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() {
      // força a troca do SW antigo pro novo imediatamente
      updateSW();
      window.location.reload();
    },
    onOfflineReady() {
      // opcional: você pode mostrar um toast "App pronto offline"
    },
  });

  // --- Fallback explícito: garante que /sw.js seja registrado ---
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('✅ Service Worker registrado manualmente:', reg.scope);
      })
      .catch((err) => {
        console.error('❌ Erro ao registrar Service Worker manualmente:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
