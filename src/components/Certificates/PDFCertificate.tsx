// src/components/Certificates/PDFCertificate.tsx
import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import CertificatePreview from "./CertificatePreview";

type Props = {
  certificateData: any;
  onClose: () => void;
  canCloseOutside?: boolean;
  canCloseEsc?: boolean;
};

export default function PDFCertificate({
  certificateData,
  onClose,
  canCloseOutside = true,
  canCloseEsc = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  /* ===== Bloqueia scroll ===== */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  /* ===== ESC fecha ===== */
  useEffect(() => {
    if (!canCloseEsc) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [canCloseEsc, onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1500] animate-fadeIn"
      onClick={() => {
        if (canCloseOutside) onClose();
      }}
    >
      <div
        className="bg-white w-[850px] max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border relative p-6 animate-popUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex justify-between items-center pb-3 border-b">
          <h2 className="text-lg font-semibold text-gray-700">
            Atestado do Paciente
          </h2>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pré-visualização */}
        <div className="mt-4 scale-[0.90] origin-top">
          <CertificatePreview ref={ref} data={certificateData} />
        </div>
      </div>

      {/* ✨ Estilos iOS (fade + zoom) */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
          to {
            opacity: 1;
            backdrop-filter: blur(8px);
          }
        }

        @keyframes popUp {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(15px);
          }
          60% {
            opacity: 1;
            transform: scale(1.03) translateY(0px);
          }
          100% {
            transform: scale(1) translateY(0px);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.28s ease-out forwards;
        }

        .animate-popUp {
          animation: popUp 0.32s cubic-bezier(0.18, 0.89, 0.35, 1.15) forwards;
        }
      `}</style>
    </div>
  );
}
