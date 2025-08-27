import React from "react";
import { Edit2, Trash2, Camera } from "lucide-react";
import { Professional } from "../../types";

interface ProfessionalCardProps {
  professional: Professional;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPhotoChange: (id: string, photoFile: File) => void;
}

const ProfessionalCard: React.FC<ProfessionalCardProps> = ({
  professional,
  onToggle,
  onEdit,
  onDelete,
  onPhotoChange,
}) => {
  const inputId = `avatar-file-${professional.id}`;
  const placeholder = "https://placehold.co/96x96?text=Foto";
  const hasAvatar = !!professional.avatar && professional.avatar !== placeholder;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onPhotoChange(professional.id, f);
    e.currentTarget.value = ""; // permite reenviar o mesmo arquivo
  };

  // preço no formato anterior (azul e sem casas)
  const preco =
    "R$ " +
    Number(professional.value).toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        {/* ESQUERDA: avatar + infos */}
        <div className="flex items-center gap-x-4">
          {/* Avatar com overlay clicável */}
          <div className="relative inline-block group">
            <img
              src={hasAvatar ? (professional.avatar as string) : placeholder}
              alt={professional.name}
              className="w-16 h-16 rounded-full object-cover border"
              referrerPolicy="no-referrer"
            />
            <label
              htmlFor={inputId}
              className="absolute inset-0 rounded-full cursor-pointer bg-black/0 group-hover:bg-black/15 flex items-center justify-center transition-colors"
              title="Alterar foto"
            >
              <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {professional.name}
            </h3>
            <p className="text-sm text-gray-500">{professional.specialty}</p>

            {/* Valor em AZUL (como antes) */}
            <div className="mt-2 text-sm leading-5">
              <span className="text-blue-600 block">Valor</span>
              <span className="text-blue-600 font-medium">{preco}</span>
            </div>
          </div>
        </div>

        {/* DIREITA: coluna com switch em cima e ícones embaixo */}
        <div className="flex flex-col items-end gap-3">
          {/* Switch com deslizamento */}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={professional.isActive}
              onChange={() => onToggle(professional.id)}
              className="sr-only peer"
            />
            <div
              className="
                w-11 h-6 rounded-full bg-gray-200
                peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-400
                peer-checked:bg-blue-500
                relative transition-colors
                after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                after:h-5 after:w-5 after:bg-white after:rounded-full after:transition-all
                peer-checked:after:translate-x-5
              "
            />
          </label>

          {/* Ações (EDITAR + DELETAR) — abaixo do switch */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onEdit(professional.id)}
              className="p-2 rounded-full hover:bg-blue-50"
              aria-label="Editar profissional"
              title="Editar"
            >
              <Edit2 className="w-4 h-4 text-blue-600" />
            </button>
            <button
              onClick={() => onDelete(professional.id)}
              className="p-2 rounded-full hover:bg-red-50"
              aria-label="Excluir profissional"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalCard;
