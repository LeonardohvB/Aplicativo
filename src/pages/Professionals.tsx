import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import ProfessionalCard from '../components/Professionals/ProfessionalCard';
import AddProfessionalModal from '../components/Professionals/AddProfessionalModal';
import EditProfessionalModal from '../components/Professionals/EditProfessionalModal';
import { useProfessionals } from '../hooks/useProfessionals';
import { Professional } from '../types';
import { supabase } from '../lib/supabase'; 

const Professionals: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const { professionals, loading, addProfessional, updateProfessional, toggleProfessional, deleteProfessional } = useProfessionals();

  const handleEdit = (id: string) => {
    const professional = professionals.find(p => p.id === id);
    if (professional) {
      setEditingProfessional(professional);
      setIsEditModalOpen(true);
    }
  };

  const handleAdd = async (newProfessional: {
    name: string;
    specialty: string;
    value: number;
  }) => {
    await addProfessional(newProfessional);
    setIsModalOpen(false);
  };

  const handleUpdate = async (id: string, updates: {
    name: string;
    specialty: string;
    value: number;
  }) => {
    await updateProfessional(id, updates);
    setIsEditModalOpen(false);
    setEditingProfessional(null);
  };

  const handlePhotoChange = async (id: string, photoFile: File) => {
  try {
    setUploadingPhoto(id);

    // caminho único por profissional
    const ext = photoFile.name.split('.').pop() || 'jpg';
    const path = `professionals/${id}/${Date.now()}.${ext}`;

    // upload no bucket "avatars" (usa upsert para substituir se já existir)
    const { error: upErr } = await supabase
      .storage
      .from('avatars')
      .upload(path, photoFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: photoFile.type || 'image/jpeg',
      });

    if (upErr) throw upErr;

    // URL pública (para bucket público)
    const { data: pub } = supabase
      .storage
      .from('avatars')
      .getPublicUrl(path);

    const publicUrl = pub.publicUrl;

    // atualiza o registro na tabela "professionals"
    const current = professionals.find(p => p.id === id);
    if (!current) return;

    await updateProfessional(id, {
      name: current.name,
      specialty: current.specialty,
      value: current.value,
      avatar: publicUrl,     // <— agora fica persistido
    });

  } catch (error) {
    console.error('Erro ao fazer upload da foto:', error);
    alert('Erro ao enviar a foto. Confira as permissões do bucket.');
  } finally {
    setUploadingPhoto(null);
  }
};

  if (loading) {
    return (
      <div className="p-6 pb-24 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Carregando profissionais...</div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profissionais</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4">
        {professionals.map((professional) => (
          <ProfessionalCard
            key={professional.id}
            professional={professional}
            onToggle={toggleProfessional}
            onEdit={handleEdit}
            onDelete={deleteProfessional}
            onPhotoChange={handlePhotoChange}
          />
        ))}
        
        {uploadingPhoto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-700">Alterando foto...</p>
            </div>
          </div>
        )}
      </div>

      <AddProfessionalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAdd}
      />

      <EditProfessionalModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProfessional(null);
        }}
        onUpdate={handleUpdate}
        professional={editingProfessional}
      />
    </div>
  );
};

export default Professionals;