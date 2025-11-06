// src/components/common/SwipeRow.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Archive } from "lucide-react";


type Props = {
  rowId: string;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
};

/**
 * SwipeRow com:
 * - ações à direita "sob" o conteúdo (não sobrepõe quando fechado)
 * - threshold de movimento (evita fechar/abrir no simples tap)
 * - desktop/mobile estável
 */
export default function SwipeRow({
  rowId, isOpen, onOpen, onClose, onEdit, onDelete, children,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);
  const [tx, setTx] = useState(0);

  // largura da área de ações
  const ACTIONS_WIDTH = 100;
  const OPEN_TX = -ACTIONS_WIDTH;
  const DRAG_THRESHOLD = 6; // px mínimos para considerar "arrasto"

  // fecha ao clicar fora
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  // sincroniza posição externa
  useEffect(() => {
    setTx(isOpen ? OPEN_TX : 0);
  }, [isOpen]);

  const begin = (clientX: number, target: EventTarget | null) => {
    // não inicia swipe se tocar nos botões
    if ((target as Element)?.closest?.('[data-noswipe]')) return;
    dragging.current = true;
    moved.current = false;
    startX.current = clientX;
  };

  const move = (clientX: number) => {
    if (!dragging.current) return;
    const dx = clientX - startX.current;

    if (!moved.current && Math.abs(dx) >= DRAG_THRESHOLD) moved.current = true;
    if (!moved.current) return;

    let next = (isOpen ? OPEN_TX : 0) + dx;
    next = Math.min(0, Math.max(next, -ACTIONS_WIDTH));
    setTx(next);
  };

  const end = () => {
    if (!dragging.current) return;
    dragging.current = false;

    // tap sem arrasto: mantém estado atual
    if (!moved.current) {
      setTx(isOpen ? OPEN_TX : 0);
      return;
    }

    if (tx < -40) { setTx(OPEN_TX); onOpen(rowId); }
    else { setTx(0); onClose(); }
  };

  return (
    <div ref={containerRef} className="relative select-none overflow-hidden">
      {/* Painel de ações - fica por baixo do conteúdo */}
      <div
        className="absolute right-0 top-0 h-full w-24 pr-2 pl-2 flex items-center justify-center z-0 pointer-events-none"
      >
        <div
  className="flex flex-col items-center justify-center gap-3 p-0 bg-transparent shadow-none border-0"
>

         <button
  type="button"
  data-noswipe
  onMouseDown={(e) => e.stopPropagation()}
  onClick={(e) => { e.stopPropagation(); onEdit(); }}
  className="p-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow 
             transition-all duration-200 ease-out hover:scale-110 pointer-events-auto"
  title="Editar"
>
  <Edit2 className="w-4 h-4" />
</button>

<button
  type="button"
  data-noswipe
  onMouseDown={(e) => e.stopPropagation()}
  onClick={(e) => { e.stopPropagation(); onDelete(); }}
  className="p-4 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white shadow 
             transition-all duration-200 ease-out hover:scale-110 pointer-events-auto"
  title="Arquivar"
>
  <Archive className="w-4 h-4" />
</button>

        </div>
      </div>

      {/* Conteúdo deslizante */}
      <div
        className="relative z-10 bg-transparent"
        style={{
          transform: `translateX(${tx}px)`,
          transition: dragging.current ? 'none' : 'transform 180ms ease',
          willChange: 'transform',
        }}
        onPointerDown={(e) => begin(e.clientX, e.target)}
        onPointerMove={(e) => move(e.clientX)}
        onPointerUp={end}
        onTouchStart={(e) => begin(e.touches[0].clientX, e.target)}
        onTouchMove={(e) => move(e.touches[0].clientX)}
        onTouchEnd={end}
      >
        {children}
      </div>
    </div>
  );
}
