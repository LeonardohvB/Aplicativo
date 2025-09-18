// src/components/SplashScreen.tsx
import React, { useEffect, useState } from 'react';

type Props = {
  duration?: number;         // tempo visível antes de sumir (ms)
  onDone?: () => void;       // chamado quando termina a animação
};

export default function SplashScreen({ duration = 1200, onDone }: Props) {
  const [leaving, setLeaving] = useState(false);

  // Branding opcional via .env
  const BRAND = import.meta.env.VITE_APP_BRAND ?? 'CL';
  const LOGO  = import.meta.env.VITE_APP_LOGO as string | undefined;

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), duration);      // começa fade-out
    const t2 = setTimeout(() => onDone?.(), duration + 320);      // fim da transição
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration, onDone]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 transition-opacity duration-300 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      {/* blobs suaves */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-72 w-72 rounded-full bg-blue-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl" />

      {/* marca + anel animado */}
      <div className="relative">
        {/* anel externo girando */}
        <div className="absolute -inset-3 rounded-[22px] border-2 border-blue-500/25 animate-spin" />

        {/* brilho atrás */}
        <div className="absolute inset-0 rounded-2xl bg-blue-500/10 blur-xl" />

        {/* “cartão” central */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-xl">
          {LOGO ? (
            <img src={LOGO} alt="Logo" className="h-10 w-10 object-contain" />
          ) : (
            <span className="text-xl font-bold text-slate-900">{BRAND}</span>
          )}
        </div>
      </div>
    </div>
  );
}
