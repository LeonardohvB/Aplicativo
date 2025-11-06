// src/components/Dashboard/StatCard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  color?: 'blue' | 'orange' | 'purple' | 'green' | 'slate';
  /** Quando true, mascara dígitos e separadores (0-9 . ,) por • e desativa animação */
  maskDigits?: boolean;
  /** Tamanho do padding/tipografia do card (apenas conteúdo) */
  size?: 'sm' | 'md';
  /** Classes extras opcionais no wrapper interno */
  className?: string;
  /** Slot opcional à direita do cabeçalho (ex: botão de ação “olho”) */
  rightSlot?: React.ReactNode;
};

const pillMap: Record<NonNullable<Props['color']>, string> = {
  blue:   'bg-gradient-to-br from-blue-500 to-indigo-600',
  orange: 'bg-gradient-to-br from-orange-500 to-pink-500',
  purple: 'bg-gradient-to-br from-violet-500 to-fuchsia-600',
  green:  'bg-gradient-to-br from-emerald-500 to-green-600',
  slate:  'bg-gradient-to-br from-slate-400 to-slate-600',
};

/* ========= Helpers numéricos / animação ========= */

function parseNumeric(val: React.ReactNode): { num: number; kind: 'currency' | 'int' | 'float' } | null {
  if (typeof val === 'number') {
    const kind = Number.isInteger(val) ? 'int' : 'float';
    return { num: val, kind };
  }
  if (typeof val === 'string') {
    const isCurrency = val.trim().startsWith('R$');
    const only = val.replace(/[^\d.,-]/g, '');
    const normalized = only.replace(/\./g, '').replace(',', '.');
    const num = Number(normalized);
    if (!isNaN(num)) {
      return { num, kind: isCurrency ? 'currency' : (Number.isInteger(num) ? 'int' : 'float') };
    }
  }
  return null;
}

function formatByKind(n: number, kind: 'currency' | 'int' | 'float') {
  if (kind === 'currency') {
    return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (kind === 'int') {
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  }
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) { setVal(to); return; }

    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const current = from + (to - from) * eased;
      setVal(current);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return val;
}

/* ================= Componente ================= */

export default function StatCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  maskDigits = false,
  size = 'md',
  className = '',
  rightSlot,
}: Props) {
  const parsed = useMemo(() => parseNumeric(value), [value]);

  // Se está mascarando, não anima (para manter quantidade de bolinhas estável)
  const animatedVal = useCountUp(parsed && !maskDigits ? parsed.num : 0);

  const SIX_DOTS = '•'.repeat(6);
  let display: React.ReactNode;

  if (parsed) {
    const baseNumber = (!maskDigits ? (parsed.kind === 'int' ? Math.round(animatedVal) : animatedVal) : parsed.num);
    const formatted = formatByKind(baseNumber, parsed.kind);
    display = maskDigits ? formatted.replace(/[0-9.,]+/g, SIX_DOTS) : formatted;
  } else if (typeof value === 'string') {
    display = maskDigits ? value.replace(/[0-9.,]+/g, SIX_DOTS) : value;
  } else {
    display = value;
  }

  const paddingCls = size === 'sm' ? 'p-1 md:p-2' : 'p-1 md:p-2';
  const iconBoxCls = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  const iconSizeCls = size === 'sm' ? 'w-[18px] h-[18px]' : 'w-5 h-5';
  const titleCls = size === 'sm' ? 'text-[13px]' : 'text-sm';
  const valueCls = size === 'sm' ? 'text-xl' : 'text-2xl';

  return (
    // Wrapper apenas com padding; o card (bg/border/shadow) fica no container externo
    <div className={[paddingCls, className].join(' ')}>
      <div className="flex items-start justify-between">
        <div
          className={[
            'inline-flex items-center justify-center',
            iconBoxCls,
            'rounded-xl text-white shadow-md ring-1 ring-black/5',
            pillMap[color],
          ].join(' ')}
        >
          {Icon ? <Icon className={iconSizeCls} aria-hidden="true" /> : null}
        </div>

        {/* Slot opcional no canto superior direito (ex: botão “olho”) */}
        {rightSlot ? <div className="ml-3">{rightSlot}</div> : null}
      </div>

      <p className={['mt-3', titleCls, 'text-slate-600'].join(' ')}>
        {title}
      </p>

      <div className={['mt-1', valueCls, 'font-semibold tracking-tight text-slate-900 tabular-nums'].join(' ')}>
        {display}
      </div>
    </div>
  );
}
