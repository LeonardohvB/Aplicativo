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
  const handlePhotoClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        onPhotoChange(professional.id, file);
      }
    };
    input.click();
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <img
              src={professional.avatar}
              alt={professional.name}
              className="w-12 h-12 rounded-full object-cover"
            />
            <button
              onClick={handlePhotoClick}
              className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Alterar foto"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
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
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
          </label>
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit(professional.id)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(professional.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
