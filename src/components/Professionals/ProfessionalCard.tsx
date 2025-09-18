// src/components/Professionals/ProfessionalCard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Camera, Phone, BadgeCheck } from "lucide-react";
import { Professional } from "../../types";
import {
  publicUrlFromPath,
  uploadAvatarAndCleanup,
  removeAvatarAndCleanup,
} from "../../lib/avatars";
import AvatarPreviewModal from "./AvatarPreviewModal";

interface ProfessionalCardProps {
  professional: Professional;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void; // não usado aqui
  onPhotoChange: (id: string, photoFile: File) => void; // compatibilidade
}

const placeholder = "https://placehold.co/96x96?text=Foto";

const withCacheBust = (url: string, v?: string | null) =>
  v ? `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}` : url;

/** Retorna uma URL exibível a partir de (path ou URL) + fallback */
function toDisplayUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // se já é http(s), usa direto; senão é path de storage
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return publicUrlFromPath(trimmed) || null;
}

function resolveAvatarBaseUrl(p: Professional): string {
  // principais no app (camelCase)
  const camelPathOrUrl = (p as any).avatar as string | undefined;
  const camel = toDisplayUrl(camelPathOrUrl);

  // compat: se vier snake_case junto
  const snakePath = (p as any).avatar_path as string | undefined;
  const snake = toDisplayUrl(snakePath);

  return camel || snake || placeholder;
}
function resolveAvatarVersion(p: Professional): string | undefined {
  return (p as any).avatarUpdatedAt ?? (p as any).avatar_updated_at ?? undefined;
}

const ProfessionalCard: React.FC<ProfessionalCardProps> = ({
  professional,
  onToggle,
  onEdit,
  // onDelete
  onPhotoChange,
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);

  // Estado local para refletir imediatamente as mudanças de avatar
  const [avatarVersion, setAvatarVersion] = useState<string | null>(
    resolveAvatarVersion(professional) || null
  );
  const [avatarPathOrUrl, setAvatarPathOrUrl] = useState<string | null>(
    // preferir camelCase, senão snake_case
    ((professional as any).avatar as string | undefined) ??
      ((professional as any).avatar_path as string | undefined) ??
      null
  );

  // Quando as props mudarem (troca de aba/refetch), sincroniza o state local
  useEffect(() => {
    setAvatarVersion(resolveAvatarVersion(professional) || null);
    const next =
      ((professional as any).avatar as string | undefined) ??
      ((professional as any).avatar_path as string | undefined) ??
      null;
    setAvatarPathOrUrl(next);
  }, [professional]);

  const avatarSrc = useMemo(() => {
    const base =
      toDisplayUrl(avatarPathOrUrl) ?? resolveAvatarBaseUrl(professional);
    return withCacheBust(base, avatarVersion);
  }, [avatarPathOrUrl, avatarVersion, professional]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // ===== Handlers passados para o modal =====
  const handleReplaceFromModal = async (id: string, file: File) => {
    try {
      const { path, updatedAt } = await uploadAvatarAndCleanup(id, file);
      // atualiza localmente com o path novo
      setAvatarPathOrUrl(path);
      setAvatarVersion(updatedAt);
      onPhotoChange(id, file);
    } catch (err) {
      console.error("Erro ao substituir avatar:", err);
      alert("Não foi possível atualizar a foto. Tente novamente.");
    }
  };

  const handleRemoveFromModal = async (id: string) => {
    try {
      await removeAvatarAndCleanup(id);
      setAvatarPathOrUrl(null);
      setAvatarVersion(String(Date.now())); // força cache-busting do placeholder
    } catch (err) {
      console.error("Erro ao remover avatar:", err);
      alert("Não foi possível remover a foto. Tente novamente.");
    }
  };
  // =========================================

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
        <div
          className="relative"
          onClick={stop}
          onMouseDown={stop}
        >
          <button
            type="button"
            className="relative h-16 w-16 rounded-full overflow-hidden ring-2 ring-gray-100 hover:scale-[1.02] transition"
            onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
            onMouseDown={stop}
            title="Visualizar foto"
          >
            <img
              src={avatarSrc}
              alt={professional.name}
              className="h-full w-full object-cover"
              onError={(e) => ((e.currentTarget as HTMLImageElement).src = placeholder)}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            {!avatarPathOrUrl && (
              <span className="absolute inset-0 grid place-items-center text-xs text-gray-400">
                <Camera className="w-4 h-4" />
              </span>
            )}
          </button>

          <span
            className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ring-2 ring-white ${
              professional.isActive ? "bg-emerald-500" : "bg-gray-300"
            }`}
            title={professional.isActive ? "Ativo" : "Inativo"}
          />
        </div>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 sm:gap-y-3">
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

            <div className="flex items-start justify-center" onClick={stop} onMouseDown={stop}>
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

            <div className="col-span-2 my-3 h-px bg-gradient-to-r from-gray-100 via-gray-100 to-transparent" />

            <div className="space-y-1.5 text-sm -ml-12 sm:-ml-3">
              {professional.phone && (
                <div className="flex items-center gap-2 text-gray-700" onClick={stop} onMouseDown={stop}>
                  <Phone className="h-4 w-4 text-blue-600" />
                  <span className="select-text">{professional.phone}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center" onClick={stop} onMouseDown={stop}>
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

            <div className="space-y-1.5 text-sm -ml-12 sm:-ml-3">
              <div className="flex items-center gap-2 text-gray-700">
                <BadgeCheck className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Registro:</span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                  {professional.registrationCode}
                </span>
              </div>
            </div>

            <div />
          </div>
        </div>
      </div>

      {/* Modal: visualizar / editar / remover foto */}
      <AvatarPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        professional={professional}
        onChange={handleReplaceFromModal}
        onRemove={handleRemoveFromModal}
        avatarPathOverride={
          // passa sempre o que estamos usando localmente
          avatarPathOrUrl ?? undefined
        }
        avatarVersionOverride={avatarVersion ?? undefined}
      />
    </div>
  );
};

export default React.memo(ProfessionalCard);
