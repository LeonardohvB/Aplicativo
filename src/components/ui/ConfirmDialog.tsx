import React, { useEffect } from "react";
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
  // fecha com ESC e bloqueia scroll quando aberto
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const confirmBtn =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 focus:ring-red-400"
      : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-400";

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      {/* painel */}
      <div className="relative w-[92vw] max-w-md rounded-2xl bg-white p-4 sm:p-5 shadow-lg animate__animated animate__zoomIn">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="mt-0.5 shrink-0 rounded-lg bg-blue-50 text-blue-600 p-2">{icon}</div>
          )}
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
            {description && <div className="mt-1 text-sm text-gray-600">{description}</div>}
          </div>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="ml-auto rounded-full p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center rounded-lg border border-black px-4 py-2 text-black hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-400"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 inline-flex items-center justify-center rounded-lg border border-black px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-offset-1 ${confirmBtn} disabled:opacity-70`}
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
