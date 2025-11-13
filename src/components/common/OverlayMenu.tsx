import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Menu as MenuIcon,
  User,
  UserPlus,
  Briefcase,
  History,
  FileText,
  Archive,
  ClipboardList,
} from "lucide-react";

// ⬇️ adicionados para o "Encerrar sessão"
import { supabase } from "../../lib/supabase";
import ConfirmDialog from "../ui/ConfirmDialog";

type Props = {
  onOpenProfile: () => void;
  onOpenNewPatient: () => void;
  onOpenNewProfessional: () => void;
  onOpenHistory: () => void;
  onOpenCertificateNew?: () => void;
  onOpenProfessionalsArchived?: () => void;
  // ⬇️ NOVO: abre a página "Registro do profissional"
  onOpenProfessionalRecord?: () => void;
};

export default function OverlayMenu({
  onOpenProfile,
  onOpenNewPatient,
  onOpenNewProfessional,
  onOpenHistory,
  onOpenCertificateNew,
  onOpenProfessionalsArchived,
  onOpenProfessionalRecord, // ⬅️ novo
}: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuItemsRef = useRef<HTMLButtonElement[]>([]);

  // diálogo de sair
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  // fechar por ESC / clique fora
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

  // scroll lock + foco inicial
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const firstBtn = panelRef.current?.querySelector<HTMLButtonElement>(
        'button[role="menuitem"]'
      );
      firstBtn?.focus();
    }, 80);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open]);

  let i = 0;
  const nextIndex = () => (i += 1) - 1;

  const reallySignOut = async () => {
    try {
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } finally {
      setSigningOut(false);
      setConfirmSignOut(false);
      setOpen(false);
    }
  };

  return (
    <>
      {/* Botão do menu (posicionado no container do App) */}
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

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[80]" // acima da BottomNav (z-[40])
            role="dialog"
            aria-modal="true"
            aria-labelledby="overlay-menu-title"
          >
            {/* Overlay */}
            <div className="absolute inset-0 z-[80] bg-black/40 backdrop-blur-[2px]" />

            {/* Painel */}
            <div
              id="overlay-menu-panel"
              ref={panelRef}
              className="absolute left-1/2 -translate-x-1/2 top-4 bottom-4 z-[81] w-[92%] max-w-sm rounded-xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden animate-[slideDown_.18s_ease-out] flex flex-col"
              role="menu"
              aria-labelledby="overlay-menu-title"
              onKeyDown={onKeyNav}
            >
              {/* Cabeçalho */}
              <div className="flex items-center justify-between px-4 py-3">
                <div
                  id="overlay-menu-title"
                  className="text-xs font-semibold text-emerald-600"
                >
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

              {/* Conteúdo rolável */}
              <div className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+96px)]">
                <div className="px-4 py-2 text-[11px] font-bold tracking-wide text-slate-500">
                  INÍCIO
                </div>

                <ul className="px-1 pb-3 text-sm text-slate-700">
                  <li>
                    <button
                      role="menuitem"
                      ref={(el) => registerItemRef(el, nextIndex())}
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

                  <li>
                    <button
                      role="menuitem"
                      ref={(el) => registerItemRef(el, nextIndex())}
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

                  <li>
                    <button
                      role="menuitem"
                      ref={(el) => registerItemRef(el, nextIndex())}
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

                  {/* 🌟 NOVO ITEM: Registro do profissional */}
                  {onOpenProfessionalRecord && (
                    <li>
                      <button
                        role="menuitem"
                        ref={(el) => registerItemRef(el, nextIndex())}
                        onClick={() => {
                          setOpen(false);
                          onOpenProfessionalRecord();
                        }}
                        className="w-full px-3 py-3 flex items-center gap-2 rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Registro do profissional</span>
                      </button>
                    </li>
                  )}

                  <li>
                    <button
                      role="menuitem"
                      ref={(el) => registerItemRef(el, nextIndex())}
                      onClick={() => {
                        setOpen(false);
                        window.dispatchEvent(
                          new CustomEvent("evolution:open")
                        );
                      }}
                      className="w-full px-3 py-3 flex items-center gap-2 rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                    >
                      <ClipboardList className="h-4 w-4" />
                      <span>Evolução do paciente</span>
                    </button>
                  </li>

                  {onOpenCertificateNew && (
                    <li>
                      <button
                        role="menuitem"
                        ref={(el) => registerItemRef(el, nextIndex())}
                        onClick={() => {
                          setOpen(false);
                          onOpenCertificateNew();
                        }}
                        className="w-full px-3 py-3 flex items-center gap-2 rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Atestado</span>
                      </button>
                    </li>
                  )}

                  <li>
                    <button
                      role="menuitem"
                      ref={(el) => registerItemRef(el, nextIndex())}
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

                <div className="h-2" />
              </div>

              {/* Rodapé */}
              <div className="bg-white border-t border-slate-100">
                {onOpenProfessionalsArchived && (
                  <ul className="px-1 py-2 text-sm text-slate-700">
                    <li>
                      <button
                        role="menuitem"
                        ref={(el) => registerItemRef(el, nextIndex())}
                        onClick={() => {
                          setOpen(false);
                          onOpenProfessionalsArchived();
                        }}
                        className="w-full px-3 py-3 flex items-center gap-2 rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                      >
                        <Archive className="h-4 w-4 text-amber-600" />
                        <span>Profissionais desativados</span>
                      </button>
                    </li>
                  </ul>
                )}

                <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                  <button
                    role="menuitem"
                    ref={(el) => registerItemRef(el, nextIndex())}
                    onClick={() => setConfirmSignOut(true)}
                    disabled={signingOut}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 16l4-4m0 0l-4-4m4 4H7"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 8v8a4 4 0 004 4h2"
                      />
                    </svg>
                    Encerrar sessão
                  </button>
                </div>
              </div>
            </div>

            <style>{`
              @keyframes slideDown {
                from { opacity: 0; transform: translate(-50%, -6px); }
                to   { opacity: 1; transform: translate(-50%, 0); }
              }
            `}</style>
          </div>,
          document.body
        )}

      <ConfirmDialog
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={reallySignOut}
        title="Encerrar sessão?"
        description="Você precisará entrar novamente para acessar o sistema."
        confirmText="Sair"
        cancelText="Cancelar"
      />
    </>
  );
}
