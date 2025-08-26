import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Auto-update PWA after each deploy
if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() {
      updateSW();        // apply new SW immediately
      window.location.reload();
    },
    onOfflineReady() {
      // optional: show a toast "App pronto para uso offline"
    },
  });
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);