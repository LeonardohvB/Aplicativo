// src/pages/LoginGate.tsx
import React, { useState, useEffect } from 'react';
import SplashScreen from '../components/SplashScreen';
import Login from './Login';

export default function LoginGate() {
  const [ready, setReady] = useState(false);

  // Se quiser fazer alguma checagem antes de liberar (ex.: fonts, sessão, etc.)
  useEffect(() => {
    // Exemplo simples: só espera a animação terminar (controlado pelo Splash)
  }, []);

  return ready ? <Login /> : <SplashScreen duration={1200} onDone={() => setReady(true)} />;
}
