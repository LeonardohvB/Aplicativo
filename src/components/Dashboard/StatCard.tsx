// src/components/Dashboard/StatCard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  value: React.ReactNode;                 // mantém compatibilidade
  icon?: LucideIcon;
  color?: 'blue' | 'orange' | 'purple' | 'green' | 'slate';
  dropdown?: boolean;                     // mantido só p/ compatibilidade
};

const pillMap: Record<NonNullable<Props['color']>, string> = {
  blue:   'bg-gradient-to-br from-blue-500 to-indigo-600',
  orange: 'bg-gradient-to-br from-orange-500 to-pink-500',
  purple: 'bg-gradient-to-br from-violet-500 to-fuchsia-600',
  green:  'bg-gradient-to-br from-emerald-500 to-green-600',
  slate:  'bg-gradient-to-br from-slate-400 to-slate-600',
};

/* =========================
   Helpers p/ animar números
========================= */

// tenta extrair um número de um ReactNode (suporta "R$ 1.234,56" ou "1234.56")
function parseNumeric(val: React.ReactNode): { num: number; kind: 'currency' | 'int' | 'float' } | null {
  if (typeof val === 'number') {
    const kind = Number.isInteger(val) ? 'int' : 'float';
    return { num: val, kind };
  }
  if (typeof val === 'string') {
    const isCurrency = val.trim().startsWith('R$');
    // normaliza "1.234,56" -> "1234.56"
    const only = val.replace(/[^\d.,-]/g, '');
    const normalized = only.replace(/\./g, '').replace(',', '.');
    const num = Number(normalized);
    if (!isNaN(num)) {
      return { num, kind: isCurrency ? 'currency' as const : (Number.isInteger(num) ? 'int' : 'float') };
    }
  }
  return null;
}

function formatByKind(n: number, kind: 'currency' | 'int' | 'float') {
  if (kind === 'currency') {
    return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (kind === 'int') return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    // inicia do último valor renderizado
    const from = fromRef.current;
    const to = target;

    // se já está igual, não anima
    if (from === to) {
      setVal(to);
      return;
    }

    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const current = from + (to - from) * eased;
      setVal(current);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return val;
}

/* =========================
   Componente
========================= */

export default function StatCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
}: Props) {
  // decide se anima (somente quando value for numérico ou moeda)
  const parsed = useMemo(() => parseNumeric(value), [value]);
  const animatedVal = useCountUp(parsed ? parsed.num : 0);

  return (
    <div className="p-4 md:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between">
        {/* Pill degradê */}
        <div
          className={[
            'inline-flex items-center justify-center',
            'w-10 h-10 rounded-xl',
            'text-white shadow-md ring-1 ring-black/5',
            pillMap[color],
          ].join(' ')}
        >
          {Icon ? <Icon className="w-5 h-5" /> : null}
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600">{title}</p>

      {/* Valor (anima quando possível; caso contrário, mostra value original) */}
      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {parsed ? formatByKind(parsed.kind === 'int' ? Math.round(animatedVal) : animatedVal, parsed.kind) : value}
      </div>
    </div>
  );
}
