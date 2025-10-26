import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'animate.css';

// Registrar o service worker somente em produção (build/preview/prod).
// Em desenvolvimento (vite dev), o sw.js gerado pelo generateSW não existe ainda
// e tentar registrar ele quebra o localhost.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('✅ Service Worker registrado:', reg.scope);
      })
      .catch((err) => {
        console.error('❌ Erro ao registrar Service Worker:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
