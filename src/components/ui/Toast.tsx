import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type ToastInput = { message: string; title?: string; type?: ToastKind; duration?: number };
type ToastItem = ToastInput & { id: string; type: ToastKind; createdAt: number };

let addToastImpl: ((t: ToastInput) => void) | null = null;

export function useToast() {
  const add = useCallback((t: ToastInput) => addToastImpl?.(t), []);
  return {
    show: add,
    success: (message: string, opts: Partial<ToastInput> = {}) =>
      add({ message, type: "success", ...opts }),
    error: (message: string, opts: Partial<ToastInput> = {}) =>
      add({ message, type: "error", ...opts }),
    info: (message: string, opts: Partial<ToastInput> = {}) =>
      add({ message, type: "info", ...opts }),
  };
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    addToastImpl = (t: ToastInput) => {
      const item: ToastItem = {
        id: Math.random().toString(36).slice(2),
        title: t.title,
        message: t.message,
        type: t.type || "info",
        duration: t.duration ?? 3000,
        createdAt: Date.now(),
      };
      setToasts((arr) => [...arr, item]);
    };
    return () => {
      addToastImpl = null;
    };
  }, []);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(
        () => setToasts((arr) => arr.filter((t) => t.id !== toast.id)),
        toast.duration
      )
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  const iconFor = (type: ToastKind) =>
    type === "success" ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
    ) : type === "error" ? (
      <AlertCircle className="w-5 h-5 text-red-600" />
    ) : (
      <Info className="w-5 h-5 text-blue-600" />
    );

  return (
  <div className="fixed z-[1100] top-4 inset-x-0 pointer-events-none">
    {/* mesmo container do app */}
    <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto animate-[toast-in_0.18s_ease-out] rounded-xl bg-white shadow-lg ring-1 ring-black/5 p-3 w-full max-w-sm"
          style={{ transformOrigin: "top center" }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {iconFor(t.type)}
            <div className="min-w-0">
              {t.title && <div className="text-sm font-semibold text-gray-900">{t.title}</div>}
              <div className="text-sm text-gray-700 break-words">{t.message}</div>
            </div>
            <button
              className="ml-auto rounded p-1 text-gray-400 hover:text-gray-600"
              onClick={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))}
              aria-label="Fechar notificação"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>

    <style>{`
      @keyframes toast-in {
        from { opacity: 0; transform: translateY(-6px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
    `}</style>
  </div>
);
}
