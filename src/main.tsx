// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'animate.css';

// ⚠️ nada de registro manual aqui
// o VitePWA (injectManifest) cuida disso automaticamente
// tanto em dev (com devOptions.enabled = true) quanto em produção

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("sw register fail", err));
  });
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
