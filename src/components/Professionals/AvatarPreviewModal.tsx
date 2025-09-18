// src/components/Professionals/AvatarPreviewModal.tsx
import React from "react";
import { X, Camera, Trash2 } from "lucide-react";
import { Professional } from "../../types";
import { publicUrlFromPath } from "../../lib/avatars";

const PLACEHOLDER = "https://placehold.co/512x512?text=Foto";

function resolveAvatarUrlFromProfessional(p: Professional): string {
  const path = (p as any).avatar_path as string | undefined;
  if (path && path.trim()) {
    const url = publicUrlFromPath(path);
    return url || PLACEHOLDER;
  }
  const url = (p as any).avatar as string | undefined;
  return (url && url.trim()) || PLACEHOLDER;
}

function resolveAvatarVersionFromProfessional(p: Professional): string | undefined {
  return (p as any).avatar_updated_at ?? (p as any).avatarUpdatedAt ?? undefined;
}

const withV = (url: string, v?: string | null) =>
  v ? `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}` : url;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  professional: Professional | null;
  onChange: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  /** overrides para mostrar sempre a foto mais recente, mesmo sem refetch do professional */
  avatarPathOverride?: string | null;
  avatarVersionOverride?: string | null;
}

export default function AvatarPreviewModal({
  isOpen,
  onClose,
  professional,
  onChange,
  onRemove,
  avatarPathOverride,
  avatarVersionOverride,
}: Props) {
  const fileRef = React.useRef<HTMLInputElement>(null);

  // fechar com ESC
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !professional) return null;

  // base e versão priorizando overrides vindos do card
  const base =
    avatarPathOverride && avatarPathOverride.trim()
      ? publicUrlFromPath(avatarPathOverride) || PLACEHOLDER
      : resolveAvatarUrlFromProfessional(professional);

  const version =
    avatarVersionOverride ?? resolveAvatarVersionFromProfessional(professional);

  const src = withV(base, version);

  const handleBackdropClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      onClose();
    }
  };

  const handleChooseFile = () => fileRef.current?.click();

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (f) onChange(professional.id, f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemove = () => onRemove(professional.id);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-label={`Foto de ${professional.name}`}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Foto de {professional.name}</h3>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* imagem */}
        <div className="p-4">
          <img
            key={src} /* força troca imediata quando o caminho/versão muda */
            src={src}
            alt={professional.name}
            className="mx-auto max-h-[60vh] w-auto rounded-lg object-contain bg-gray-50"
            draggable={false}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = PLACEHOLDER;
            }}
          />
        </div>

        {/* ações */}
        <div className="flex gap-2 p-4 border-t">
          <button
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); handleChooseFile(); }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <Camera className="w-4 h-4" />
            Alterar foto
          </button>

          <button
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); handleRemove(); }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <Trash2 className="w-4 h-4" />
            Remover foto
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
}
