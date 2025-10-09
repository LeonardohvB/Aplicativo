import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  icon?: React.ReactNode;
  variant?: "primary" | "danger";
  loading?: boolean;
};

const ConfirmDialog: React.FC<Props> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  icon,
  variant = "primary",
  loading = false,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // ESC para fechar, bloquear scroll e focar botão cancelar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // foca o cancelar para acessibilidade
    setTimeout(() => cancelBtnRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const confirmClasses =
    variant === "danger"
      ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800"
      : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800";

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" onClick={onClose} />

      {/* painel compacto */}
      <div
        className="
          relative w-full max-w-[340px] sm:max-w-[380px]
          rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/10
        "
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* cabeçalho */}
        <div className="flex items-start gap-3">
          {icon && (
            <div className="mt-0.5 shrink-0 rounded-lg bg-blue-50 text-blue-600 p-2">{icon}</div>
          )}
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
            {description && (
              <div className="mt-2 text-[13px] leading-5 text-slate-700">{description}</div>
            )}
          </div>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="ml-auto rounded-full p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ações */}
        <div className="mt-4 flex items-center justify-end gap-2">
          {/* Cancelar — cinza claro */}
          <button
            ref={cancelBtnRef}
            onClick={onClose}
            className="
              inline-flex items-center justify-center
              rounded-lg px-3 py-1.5 text-[13px] font-medium
              bg-slate-100 text-slate-700
              ring-1 ring-slate-200
              hover:bg-slate-200 active:bg-slate-300
              focus:outline-none focus:ring-2 focus:ring-slate-300
            "
          >
            {cancelText}
          </button>

          {/* Confirmar / Excluir */}
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`
              inline-flex items-center justify-center
              rounded-lg px-3 py-1.5 text-[13px] font-medium text-white
              shadow-sm transition
              ${confirmClasses}
              focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-slate-200
              disabled:opacity-70
            `}
          >
            {loading ? "Aguarde..." : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
