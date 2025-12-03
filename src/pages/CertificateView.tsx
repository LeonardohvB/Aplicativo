// src/pages/CertificateView.tsx
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { supabase } from "../lib/supabase";
import CertificatePreview from "../components/Certificates/CertificatePreview";
import { useToast } from "../components/ui/Toast";

type Props = {
  certificateId: string;
  onBack: () => void;
};

export default function CertificateView({ certificateId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [dataJson, setDataJson] = useState<any>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  // Carregar html2pdf
  useEffect(() => {
    if ((window as any).html2pdf) return;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  // Buscar o certificado no Supabase
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("data_json")
        .eq("id", certificateId)
        .maybeSingle();

      if (error || !data) {
        toast.error("Erro ao carregar o atestado.");
        setLoading(false);
        return;
      }

      setDataJson(data.data_json);
      setLoading(false);
    })();
  }, [certificateId]);

  const handleDownloadPDF = async () => {
    const w = window as any;

    if (!printRef.current) {
      toast.error("Nada para exportar. Conteúdo não carregado.");
      return;
    }
    if (!w.html2pdf) {
      toast.error("Carregando módulo de PDF... tente novamente em 1–2 segundos.");
      return;
    }

    const opt = {
      margin: 10,
      filename: `Atestado_${(dataJson?.patientName || "Paciente")
        .replace(/\s+/g, "_")}_${Date.now()}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    };

    w.html2pdf().set(opt).from(printRef.current).save();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Carregando atestado…</div>
      </div>
    );
  }

  if (!dataJson) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-gray-600 mb-4">Atestado não encontrado.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur px-4 py-3 border-b">
        <div className="flex items-center gap-3">

          <button
            onClick={onBack}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </button>

          <h1 className="text-base sm:text-lg font-semibold text-slate-900 mx-auto">
            Visualizar Atestado
          </h1>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="no-print flex gap-3 px-4 py-4 border-b bg-white">
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          <Download className="w-4 h-4" /> Baixar PDF
        </button>
      </div>

      {/* CONTENT */}
      <div className="p-4 overflow-y-auto pb-20">
        <div ref={printRef} id="print-area">
          <CertificatePreview data={dataJson} />
        </div>
      </div>
    </div>
  );
}
