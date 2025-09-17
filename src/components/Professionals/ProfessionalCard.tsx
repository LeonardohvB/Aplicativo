// src/components/Professionals/ProfessionalCard.tsx
import React from "react";
import { Camera, Phone, BadgeCheck } from "lucide-react";
import { Professional } from "../../types";
import { publicUrlFromPath } from "../../lib/avatars";

interface ProfessionalCardProps {
  professional: Professional;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;          // abre o modal de edição
  onDelete: (id: string) => void;        // continua na interface p/ o modal (não usado aqui)
  onPhotoChange: (id: string, photoFile: File) => void;
}

const placeholder = "https://placehold.co/96x96?text=Foto";
const withCacheBust = (url: string, v?: string | null) =>
  v ? `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}` : url;

function resolveAvatarBaseUrl(p: Professional): string {
  const path: string | undefined = (p as any).avatar_path;
  if (path && path.trim()) return publicUrlFromPath(path);
  const url = (p as any).avatar as string | undefined;
  return url?.trim() || placeholder;
}
function resolveAvatarVersion(p: Professional): string | undefined {
  return (p as any).avatar_updated_at ?? (p as any).avatarUpdatedAt ?? undefined;
}

const ProfessionalCard: React.FC<ProfessionalCardProps> = ({
  professional,
  onToggle,
  onEdit,
  // onDelete  <-- não desestruturar para evitar ts(6133)
  onPhotoChange,
}) => {
  const inputId = `avatar-file-${professional.id}`;
  const base = resolveAvatarBaseUrl(professional);
  const v = resolveAvatarVersion(professional);
  const avatarSrc = withCacheBust(base, v);

  // evita que elementos internos disparem o clique do card
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(professional.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(professional.id);
        }
      }}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      aria-label={`Editar ${professional.name ?? "profissional"}`}
      title="Abrir edição"
    >
      <div className="flex items-start gap-4">
        {/* Avatar com ring + overlay + status dot */}
        <div className="relative" onClick={stop}>
          <img
            src={avatarSrc}
            alt={professional.name}
            className="h-16 w-16 rounded-full object-cover ring-2 ring-gray-100"
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = placeholder)}
            loading="lazy"
            decoding="async"
          />
          <span
            className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ring-2 ring-white ${
              professional.isActive ? "bg-emerald-500" : "bg-gray-300"
            }`}
            title={professional.isActive ? "Ativo" : "Inativo"}
          />
          <label
            htmlFor={inputId}
            className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/0 transition hover:bg-black/15"
            title="Alterar foto"
            onClick={stop}
          >
            <Camera className="h-4 w-4 text-white opacity-0 transition group-hover:opacity-100" />
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            onClick={stop}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPhotoChange(professional.id, f);
              e.currentTarget.value = "";
            }}
          />
        </div>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          {/* === LAYOUT EM GRID ===
              col-esquerda: 1fr (conteúdo)
              col-direita: auto (switch em cima, "Ligar" embaixo, centralizado) */}
          <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 sm:gap-y-3">
            {/* Linha 1 — Nome + especialidade (esquerda) */}
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-gray-900">
                {professional.name}
              </div>
              {professional.specialty && (
                <div className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600">
                  {professional.specialty}
                </div>
              )}
            </div>

            {/* Linha 1 — Switch (direita) */}
            <div className="flex items-start justify-center" onClick={stop}>
              <button
                onClick={() => onToggle(professional.id)}
                className={`relative h-6 w-11 rounded-full transition ${
                  professional.isActive ? "bg-blue-600" : "bg-gray-300"
                }`}
                aria-label={professional.isActive ? "Desativar" : "Ativar"}
                title={professional.isActive ? "Desativar" : "Ativar"}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    professional.isActive ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Separador ocupando as 2 colunas */}
            <div className="col-span-2 my-3 h-px bg-gradient-to-r from-gray-100 via-gray-100 to-transparent" />

            {/* Linha 2 — Telefone (esquerda) */}
            <div className="space-y-1.5 text-sm -ml-12 sm:-ml-3">
              {professional.phone && (
                <div className="flex items-center gap-2 text-gray-700" onClick={stop}>
                  <Phone className="h-4 w-4 text-blue-600" />
                  <span className="select-text">{professional.phone}</span>
                </div>
              )}
            </div>

            {/* Linha 2 — Botão "Ligar" (direita), centralizado e abaixo do switch */}
            <div className="flex items-center justify-center" onClick={stop}>
              {professional.phone && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `tel:${professional.phone}`;
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-600 px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  title="Ligar"
                  aria-label={`Ligar para ${professional.phone}`}
                >
                  Ligar
                </button>
              )}
            </div>

            {/* Linha 3 — Registro (esquerda) */}
            <div className="space-y-1.5 text-sm -ml-12 sm:-ml-3">
              <div className="flex items-center gap-2 text-gray-700">
                <BadgeCheck className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Registro:</span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                  {professional.registrationCode}
                </span>
              </div>
            </div>

            {/* Linha 3 — coluna direita vazia (apenas para alinhamento) */}
            <div />
          </div>
          {/* === /GRID === */}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProfessionalCard);
