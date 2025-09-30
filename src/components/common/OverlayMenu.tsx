// src/components/common/OverlayMenu.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Menu as MenuIcon,
  User,
  UserPlus,
  Briefcase,
  History,
} from "lucide-react";

type Props = {
  onOpenProfile: () => void;
  onOpenNewPatient: () => void;
  onOpenNewProfessional: () => void;
  onOpenHistory: () => void;
};

export default function OverlayMenu({
  onOpenProfile,
  onOpenNewPatient,
  onOpenNewProfessional,
  onOpenHistory,
}: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<HTMLButtonElement[]>([]);

  // ---------- teclado (Up/Down/Home/End) ----------
  const registerItemRef = (el: HTMLButtonElement | null, index: number) => {
    if (!el) return;
    menuItemsRef.current[index] = el;
  };
  const focusItem = (index: number) => {
    const items = menuItemsRef.current.filter(Boolean);
    if (!items.length) return;
    const i = ((index % items.length) + items.length) % items.length;
    items[i]?.focus();
  };
  const onKeyNav = (e: React.KeyboardEvent) => {
    const items = menuItemsRef.current.filter(Boolean);
    if (!items.length) return;
    const idx = items.findIndex((el) => el === document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(idx < 0 ? 0 : idx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(idx < 0 ? items.length - 1 : idx - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(items.length - 1);
    }
  };

  // ---------- fechar por ESC / clique fora ----------
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onEsc);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  // ---------- scroll lock + foco inicial ----------
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => firstItemRef.current?.focus(), 80);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open]);

  return (
    <>
      {/* Botão do menu (posicionado pelo container no App) */}
      <button
        onClick={() => setOpen(true)}
        title="Menu"
        className="h-10 w-10 rounded-xl bg-white shadow ring-1 ring-black/5 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="overlay-menu-panel"
      >
        <MenuIcon className="h-5 w-5 text-slate-700" />
      </button>

      {/* Overlay + painel */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="overlay-menu-title"
        >
          {/* fundo escuro */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

          {/* painel */}
          <div
            id="overlay-menu-panel"
            ref={panelRef}
            className="absolute left-1/2 -translate-x-1/2 top-10 w-[92%] max-w-sm rounded-xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden animate-[slideDown_.18s_ease-out] pb-[env(safe-area-inset-bottom)]"
            role="menu"
            aria-labelledby="overlay-menu-title"
            onKeyDown={onKeyNav}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div id="overlay-menu-title" className="text-xs font-semibold text-emerald-600">
                ● Aberto <span className="text-slate-500 ml-2">(menu)</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            {/* Lista de ações */}
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="px-4 py-2 text-[11px] font-bold tracking-wide text-slate-500">
                INÍCIO
              </div>

              <ul className="px-1 pb-3 text-sm text-slate-700">
                {/* Perfil */}
                <li>
                  <button
                    role="menuitem"
                    ref={(el) => {
                      firstItemRef.current = el || null;
                      registerItemRef(el, 0);
                    }}
                    onClick={() => {
                      setOpen(false);
                      onOpenProfile();
                    }}
                    className="w-full px-3 py-3 flex items-center gap-2 rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                  >
                    <User className="h-4 w-4" />
                    <span>Perfil</span>
                  </button>
                </li>

                {/* Cadastrar paciente */}
                <li>
                  <button
                    role="menuitem"
                    ref={(el) => registerItemRef(el, 1)}
                    onClick={() => {
                      setOpen(false);
                      onOpenNewPatient();
                    }}
                    className="w-full px-3 py-3 flex items-center gap-2 rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Cadastrar paciente</span>
                  </button>
                </li>

                {/* Cadastrar profissional */}
                <li>
                  <button
                    role="menuitem"
                    ref={(el) => registerItemRef(el, 2)}
                    onClick={() => {
                      setOpen(false);
                      onOpenNewProfessional();
                    }}
                    className="w-full px-3 py-3 flex items-center gap-2 rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                  >
                    <Briefcase className="h-4 w-4" />
                    <span>Cadastrar profissional</span>
                  </button>
                </li>

                {/* Histórico de atendimentos */}
                <li>
                  <button
                    role="menuitem"
                    ref={(el) => registerItemRef(el, 3)}
                    onClick={() => {
                      setOpen(false);
                      onOpenHistory();
                    }}
                    className="w-full px-3 py-3 flex items-center gap-2 rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                  >
                    <History className="h-4 w-4" />
                    <span>Histórico de atendimentos</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* animação */}
          <style>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translate(-50%, -6px); }
              to   { opacity: 1; transform: translate(-50%, 0); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
