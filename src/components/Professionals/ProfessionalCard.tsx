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
import { shortPersonName } from '../../lib/strings';

interface ProfessionalCardProps {
  professional: Professional;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPhotoChange: (id: string, photoFile: File) => void;
}

const placeholder = "https://placehold.co/96x96?text=Foto";

/* ----------------- helpers de URL ----------------- */
function stripVersionParam(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("v");
    return u.toString();
  } catch {
    return url.replace(/[?&]v=[^&]+/, "").replace(/[?&]$/, "");
  }
}
function normalizeEncoded(url: string): string {
  try {
    if (/%25[0-9a-f]{2}/i.test(url)) {
      return decodeURIComponent(url);
    }
    return url;
  } catch {
    return url;
  }
}
const withCacheBust = (url: string, v?: string | null) =>
  v ? `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}` : url;
/* -------------------------------------------------- */

const onlyDigits = (v: string | null | undefined) =>
  String(v ?? "").replace(/\D+/g, "");
const formatPhoneBR = (v: string | null | undefined): string => {
  const d = onlyDigits(v);
  if (!d) return "—";
  const ddd = d.slice(0, 2);
  if (d.length <= 10) {
    const p1 = d.slice(2, 6);
    const p2 = d.slice(6, 10);
    return `(${ddd}) ${p1}${p2 ? `-${p2}` : ""}`;
  }
  const nine = d.slice(2, 3);
  const p1 = d.slice(3, 7);
  const p2 = d.slice(7, 11);
  return `(${ddd}) ${nine} ${p1}${p2 ? `-${p2}` : ""}`;
};

function toDisplayUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return publicUrlFromPath(trimmed) || null;
}
function resolveAvatarBaseUrl(p: Professional): string {
  const camelPathOrUrl = (p as any).avatar as string | undefined;
  const camel = toDisplayUrl(camelPathOrUrl);
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
  onEdit: _onEdit,
  onDelete: _onDelete,
  onPhotoChange,
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);

  const shortName = useMemo(
    () => shortPersonName(professional.name),
    [professional.name]
  );

  const [avatarVersion, setAvatarVersion] = useState<string | null>(
    resolveAvatarVersion(professional) || null
  );
  const [avatarPathOrUrl, setAvatarPathOrUrl] = useState<string | null>(
    ((professional as any).avatar as string | undefined) ??
      ((professional as any).avatar_path as string | undefined) ??
      null
  );

  useEffect(() => {
    setAvatarVersion(resolveAvatarVersion(professional) || null);
    const next =
      ((professional as any).avatar as string | undefined) ??
      ((professional as any).avatar_path as string | undefined) ??
      null;
    setAvatarPathOrUrl(next);
  }, [professional]);

  const avatarSrc = useMemo(() => {
    const baseRaw =
      toDisplayUrl(avatarPathOrUrl) ?? resolveAvatarBaseUrl(professional);
    const normalized = normalizeEncoded(stripVersionParam(baseRaw));
    return withCacheBust(normalized, avatarVersion);
  }, [avatarPathOrUrl, avatarVersion, professional]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // ===== Modal handlers
  const handleReplaceFromModal = async (id: string, file: File) => {
    try {
      const { path, updatedAt } = await uploadAvatarAndCleanup(id, file);
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
      setAvatarVersion(String(Date.now()));
    } catch (err) {
      console.error("Erro ao remover avatar:", err);
      alert("Não foi possível remover a foto. Tente novamente.");
    }
  };

  const formattedPhone = formatPhoneBR(professional.phone);
  const telHref = `tel:+55${onlyDigits(professional.phone)}`;
  const registry =
    professional.registrationCode ||
    (professional as any).registration ||
    (professional as any).document ||
    "";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative" onClick={stop} onMouseDown={stop}>
          <button
            type="button"
            data-noswipe
            className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-gray-100 transition hover:scale-[1.02]"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(true);
            }}
            onMouseDown={stop}
            title="Visualizar foto"
          >
            <img
              src={avatarSrc}
              alt={shortName || professional.name}
              className="h-full w-full object-cover"
              onError={(e) =>
                ((e.currentTarget as HTMLImageElement).src = placeholder)
              }
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            {!avatarPathOrUrl && (
              <span className="absolute inset-0 grid place-items-center text-xs text-gray-400">
                <Camera className="h-4 w-4" />
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
          {/* ===== Linha 1: Nome, Especialidade e Toggle ===== */}
          <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 sm:gap-y-3">
            <div className="min-w-0">
              <div
                className="truncate text-base font-semibold text-gray-900"
                title={professional.name}
              >
                {shortName}
              </div>
              {professional.specialty && (
                <div className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600">
                  {professional.specialty}
                </div>
              )}
            </div>

            <div
              className="flex items-start justify-center"
              onClick={stop}
              onMouseDown={stop}
            >
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
          </div>

          {/* ===== Linha 2: Telefone + Ligar (logo abaixo do avatar) ===== */}
          <div className="mt-3 flex items-center gap-3">
            <div
              className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-800"
              onClick={stop}
              onMouseDown={stop}
            >
              <Phone className="h-4 w-4 text-gray-600" />
              <span className="truncate select-text">{formattedPhone}</span>
            </div>

            {professional.phone && (
              <a
                href={telHref}
                onClick={stop}
                onMouseDown={stop}
                className="ml-auto inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100"
                title="Ligar"
                aria-label={`Ligar para ${formattedPhone}`}
              >
                Ligar
              </a>
            )}
          </div>

          {/* ===== Linha 3: Registro (chip) ===== */}
          <div className="mt-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              <span className="opacity-70">Registro:</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-800">
                {registry || "—"}
              </span>
            </span>
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
        avatarPathOverride={avatarPathOrUrl ?? undefined}
        avatarVersionOverride={avatarVersion ?? undefined}
      />
    </div>
  );
};

export default React.memo(ProfessionalCard);
