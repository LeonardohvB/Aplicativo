import React, { useEffect, useRef } from "react";
import { X, Menu as MenuIcon, User } from "lucide-react";

type Props = {
  onOpenProfile: () => void;   // ação quando clicar em Perfil
};

export default function OverlayMenu({ onOpenProfile }: Props) {
  const [open, setOpen] = React.useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // fecha ao clicar fora ou ESC
  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onEsc);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  return (
    <>
      {/* Botão/ícone que fica na tela de Início */}
      <button
        onClick={() => setOpen(true)}
        title="Menu"
        className="fixed right-4 top-4 z-40 h-10 w-10 rounded-xl bg-white shadow ring-1 ring-black/5 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition"
      >
        <MenuIcon className="h-5 w-5 text-slate-700" />
      </button>

      {/* Overlay + Drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          {/* fundo escuro */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

          {/* painel (estilo da imagem: cabeçalho + lista) */}
          <div
            ref={panelRef}
            className="absolute left-1/2 -translate-x-1/2 top-10 w-[92%] max-w-sm rounded-xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden animate-[slideDown_.18s_ease-out]"
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-xs font-semibold text-emerald-600">
                ● Aberto <span className="text-slate-500 ml-2">(menu)</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-slate-100 rounded"
                aria-label="Fechar"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            {/* Seções / Itens */}
            <div className="max-h-[70vh] overflow-y-auto">
              {/* Título da seção (igual “INICIO” da imagem) */}
              <div className="px-4 py-2 text-[11px] font-bold tracking-wide text-slate-500">
                INÍCIO
              </div>

              <ul className="px-1 pb-3">
                <li>
                  <button
                    onClick={() => { setOpen(false); onOpenProfile(); }}
                    className="w-full px-3 py-3 flex items-center gap-2 rounded-lg hover:bg-slate-50 text-sm"
                  >
                    <User className="h-4 w-4 text-slate-700" />
                    <span>Perfil</span>
                  </button>
                </li>

                {/* você pode adicionar mais itens aqui seguindo o mesmo padrão */}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* animação */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -6px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  );
}
