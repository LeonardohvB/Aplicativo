import React from 'react';
import { Edit2, Trash2, Camera } from 'lucide-react';
import { Professional } from '../../types';

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

  // se tem avatar "de verdade", não mostramos nenhum overlay/badge
  const placeholder = 'https://placehold.co/96x96?text=Foto';
  const hasAvatar = !!professional.avatar && professional.avatar !== placeholder;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative inline-block group">
            {/* label cobre a imagem (continua clicável/tocável), mas sem overlay quando já existe avatar */}
            <label htmlFor={inputId} className="cursor-pointer block relative" title="Alterar foto">
              <img
                src={professional.avatar || placeholder}
                alt={professional.name}
                className="w-12 h-12 rounded-full object-cover"
                loading="lazy"
              />

              {/* Só mostramos indicação quando AINDA NÃO há avatar (placeholder) */}
              {!hasAvatar && (
                <>
                  {/* Desktop: overlay apenas no hover */}
                  <span
                    className="
                      hidden md:flex
                      absolute inset-0 items-center justify-center rounded-full
                      bg-black/45 text-white opacity-0 group-hover:opacity-100
                      transition-opacity
                    "
                    aria-hidden="true"
                  >
                    <Camera className="w-4 h-4" />
                  </span>

                  {/* Mobile: badge discreto (some quando avatar existir) */}
                  <span
                    className="
                      md:hidden
                      absolute -bottom-1 -right-1 inline-flex items-center justify-center
                      h-6 w-6 rounded-full bg-black/70 text-white
                    "
                    aria-hidden="true"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </span>
                </>
              )}
            </label>

            {/* input real — sem capture p/ oferecer galeria OU câmera */}
            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) onPhotoChange(professional.id, file);
                // permite selecionar o mesmo arquivo novamente
                e.currentTarget.value = '';
              }}
            />
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">{professional.name}</h3>
            <p className="text-gray-600 text-sm">{professional.specialty}</p>
            <div className="flex items-center space-x-4 mt-2">
              <div>
                <span className="text-blue-600 font-medium text-sm">Valor</span>
                <p className="text-blue-600 font-semibold">R$ {professional.value}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={professional.isActive}
              onChange={() => onToggle(professional.id)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-400 peer-checked:bg-red-500 relative">
              <span className="absolute top-[2px] left-[2px] h-5 w-5 bg-white rounded-full transition-all peer-checked:translate-x-5" />
            </div>
          </label>

          <div className="flex space-x-2">
            <button
              onClick={() => onEdit(professional.id)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label="Editar profissional"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(professional.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              aria-label="Excluir profissional"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalCard;
