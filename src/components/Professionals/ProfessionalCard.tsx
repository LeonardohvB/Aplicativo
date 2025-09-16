// src/components/Professionals/ProfessionalCard.tsx
import React from "react";
import { Edit2, Trash2, Camera, Phone, BadgeCheck } from "lucide-react";
import { Professional } from "../../types";
import { publicUrlFromPath } from "../../lib/avatars";

interface ProfessionalCardProps {
  professional: Professional;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
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
  onDelete,
  onPhotoChange,
}) => {
  const inputId = `avatar-file-${professional.id}`;
  const base = resolveAvatarBaseUrl(professional);
  const v = resolveAvatarVersion(professional);
  const avatarSrc = withCacheBust(base, v);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-4">
        {/* Avatar com ring + overlay + status dot */}
        <div className="relative">
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
          >
            <Camera className="h-4 w-4 text-white opacity-0 transition group-hover:opacity-100" />
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPhotoChange(professional.id, f);
              e.currentTarget.value = "";
            }}
          />
        </div>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          {/* Header: nome + pill + switch */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-gray-900">
                {professional.name}
              </div>
              {/* Pill de especialidade (hierarquia: logo após o nome) */}
              <div className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
                {professional.specialty}
              </div>
            </div>

            {/* Switch */}
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

          {/* Separador sutil */}
          <div className="my-3 h-px bg-gradient-to-r from-gray-100 via-gray-100 to-transparent" />

          {/* Metadados com ícones sutis */}
          <div className="space-y-1.5 text-sm">
            {professional.phone && (
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${professional.phone}`} className="hover:underline">
                  {professional.phone}
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-700">
              <BadgeCheck className="h-4 w-4 text-gray-400" />
              <span className="font-medium">Registro:</span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                {professional.registrationCode}
              </span>
            </div>
          </div>

          {/* Ações ghost */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => onEdit(professional.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-blue-700 hover:bg-blue-50"
              title="Editar"
            >
              <Edit2 className="h-4 w-4" />
              <span className="text-sm">Editar</span>
            </button>
            <button
              onClick={() => onDelete(professional.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-red-700 hover:bg-red-50"
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-sm">Excluir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProfessionalCard);
