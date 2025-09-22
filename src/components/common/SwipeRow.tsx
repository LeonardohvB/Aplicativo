import React, { useEffect, useRef, useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';

type Props = {
  rowId: string;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Conteúdo do card */
  children: React.ReactNode;
};

/**
 * Componente de swipe LTR/RTL:
 * - Arrastar p/ ESQUERDA abre ações (Editar/Excluir)
 * - Arrastar p/ DIREITA fecha
 * - Ignora gestos que começam em elementos com [data-noswipe]
 */
export default function SwipeRow({
  rowId, isOpen, onOpen, onClose, onEdit, onDelete, children,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const dragging = useRef(false);
  const [tx, setTx] = useState(0);

  const ACTIONS_WIDTH = 100;
  const OPEN_TX = -ACTIONS_WIDTH;

  // fecha ao clicar fora
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  useEffect(() => { setTx(isOpen ? OPEN_TX : 0); }, [isOpen]);

  const begin = (clientX: number, target: EventTarget | null) => {
    // não iniciar swipe se o gesto começou em um elemento marcado
    if ((target as Element)?.closest?.('[data-noswipe]')) return;
    dragging.current = true;
    startX.current = clientX;
  };
  const move = (clientX: number) => {
    if (!dragging.current) return;
    const dx = clientX - startX.current;
    let next = (isOpen ? OPEN_TX : 0) + dx;
    next = Math.min(0, Math.max(next, -ACTIONS_WIDTH));
    setTx(next);
  };
  const end = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (tx < -40) { setTx(OPEN_TX); onOpen(rowId); }
    else { setTx(0); onClose(); }
  };

  return (
    <div ref={containerRef} className="relative select-none">
      {/* painel de ações */}
      <div className="absolute right-0 top-0 h-full w-24 pr-2 pl-2 flex items-center justify-center">
        <div className="h-[0px] w-[0px] rounded-2xl bg-white shadow-lg border border-gray-100 flex flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow transition"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-6 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow transition"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* conteúdo deslizável */}
      <div
        className="bg-transparent"
        style={{ transform: `translateX(${tx}px)`, transition: dragging.current ? 'none' : 'transform 180ms ease' }}
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
