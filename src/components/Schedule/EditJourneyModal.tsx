// src/components/Schedule/EditJourneyModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AppointmentJourney, Professional } from '../../types';
import { useToast } from '../ui/Toast';
import { supabase } from '../../lib/supabase';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (
    journeyId: string,
    journey: {
      professionalId: string;
      professionalName: string;
      date: string;
      startTime: string;
      endTime: string;
      consultationDuration: number;
      bufferDuration: number;
      defaultPrice: number;
      clinicPercentage: number;
    }
  ) => void;
  journey: AppointmentJourney | null;
  professionals: Professional[];
};

const EditJourneyModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onUpdate,
  journey,
  professionals,
}) => {
  const toast = useToast();

  const [formData, setFormData] = useState({
    professionalId: '',
    date: '',
    startTime: '',
    endTime: '',
    consultationDuration: '40',
    bufferDuration: '10',
    defaultPrice: '',
    clinicPercentage: '20',
  });

  const [showSearch, setShowSearch] = useState(false);
  const [proQuery, setProQuery] = useState('');
  const [remotePros, setRemotePros] = useState<Professional[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (journey && isOpen) {
      setFormData({
        professionalId: journey.professionalId,
        date: journey.date,
        startTime: journey.startTime,
        endTime: journey.endTime,
        consultationDuration: String(journey.consultationDuration),
        bufferDuration: String(journey.bufferDuration),
        defaultPrice: String(journey.defaultPrice),
        clinicPercentage: String(journey.clinicPercentage),
      });
      setShowSearch(false);
      setProQuery('');
      setRemotePros([]);
    }
  }, [journey, isOpen]);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [showSearch]);

  const localActivePros = useMemo(
    () => (professionals || []).filter((p) => (p as any).isActive !== false),
    [professionals]
  );

  const combinedProsForSelect: Professional[] = useMemo(() => {
    if (!formData.professionalId) return localActivePros;
    const exists = localActivePros.some((p) => p.id === formData.professionalId);
    if (exists) return localActivePros;
    const selected = remotePros.find((p) => p.id === formData.professionalId);
    return selected ? [selected, ...localActivePros] : localActivePros;
  }, [localActivePros, remotePros, formData.professionalId]);

  // ===== Busca no Supabase (com regra de "primeira letra" = prefixo) =====
  useEffect(() => {
    let ignore = false;

    const run = async () => {
      const raw = proQuery.trim();
      if (!raw) {
        if (!ignore) setRemotePros([]);
        return;
      }
      const q = raw.toLowerCase();
      setIsSearching(true);
      try {
        // Se só 1 caractere → prefixo; senão → contém
        const like = q.length === 1 ? `${q}%` : `%${q}%`;
        const { data, error } = await supabase
          .from('professionals')
          .select('id, name, specialty, is_active')
          .or(`name.ilike.${like},specialty.ilike.${like}`)
          .order('name', { ascending: true })
          .limit(30);

        if (error) throw error;

        if (!ignore) {
          const list =
            (data || [])
              .filter((p: any) => p.is_active !== false)
              .map((p: any) => ({
                id: p.id,
                name: p.name,
                specialty: p.specialty ?? '',
                isActive: p.is_active !== false,
              })) as Professional[];
          setRemotePros(list);
        }
      } catch (e) {
        console.error(e);
        if (!ignore) setRemotePros([]);
      } finally {
        if (!ignore) setIsSearching(false);
      }
    };

    const t = setTimeout(run, 250);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [proQuery]);

  // ===== Painel de sugestões (só mostra após digitar) com regra de iniciais =====
  const panelOptions: Professional[] = useMemo(() => {
    const raw = proQuery.trim();
    if (!raw) return [];
    const q = raw.toLowerCase();

    // Junta remotos + locais e tira duplicados
    const source = [...remotePros, ...localActivePros];
    const uniqById = new Map<string, Professional>();
    for (const p of source) if (!uniqById.has(p.id)) uniqById.set(p.id, p);
    const uniq = [...uniqById.values()];

    // Normalizador
    const norm = (s: string) => (s || '').toLowerCase().trim();

    return uniq.filter((p) => {
      const name = norm(p.name);
      const spec = norm(p.specialty || '');
      if (q.length === 1) {
        // 1ª letra: precisa ser a inicial do nome OU da especialidade
        return name.startsWith(q) || spec.startsWith(q);
      }
      // Para consultas maiores: "prefixo de palavra" no nome ou especialidade
      const tokens = (name + ' ' + spec).split(/\s+/).filter(Boolean);
      return tokens.some((t) => t.startsWith(q));
    });
  }, [proQuery, remotePros, localActivePros]);

  const pickProfessional = (p: Professional) => {
    setFormData((s) => ({ ...s, professionalId: p.id }));
    setProQuery('');
    setShowSearch(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.professionalId ||
      !formData.date ||
      !formData.startTime ||
      !formData.endTime ||
      !formData.defaultPrice ||
      !formData.clinicPercentage
    ) {
      toast.error('Por favor, preencha todos os campos obrigatórios.', {
        title: 'Campos obrigatórios',
      });
      return;
    }

    if (formData.startTime >= formData.endTime) {
      toast.error('A hora final deve ser posterior à hora inicial.', {
        title: 'Horário inválido',
      });
      return;
    }

    const todayISO = new Date().toISOString().slice(0, 10);
    if (formData.date === todayISO) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      if (formData.startTime < `${hh}:${mm}`) {
        toast.error('Não é possível agendar para um horário que já passou hoje.', {
          title: 'Horário inválido',
        });
        return;
      }
    }

    if (!journey) return;

    const selected =
      combinedProsForSelect.find((p) => p.id === formData.professionalId) ||
      remotePros.find((p) => p.id === formData.professionalId);

    if (!selected) {
      toast.error('Profissional não encontrado.', { title: 'Erro' });
      return;
    }

    onUpdate(journey.id, {
      professionalId: formData.professionalId,
      professionalName: selected.name,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      consultationDuration: parseInt(formData.consultationDuration),
      bufferDuration: parseInt(formData.bufferDuration),
      defaultPrice: parseFloat(formData.defaultPrice),
      clinicPercentage: parseFloat(formData.clinicPercentage),
    });

    toast.success('Jornada atualizada com sucesso!', { title: 'Salvo' });
    onClose();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  if (!isOpen || !journey) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Editar Jornada de Atendimento
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* PROFISSIONAL */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Profissional *
              </label>
              <button
                type="button"
                onClick={() => setShowSearch((s) => !s)}
                title={showSearch ? 'Fechar busca' : 'Pesquisar profissional'}
                className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-2 py-1.5 text-gray-600 hover:text-gray-900"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </button>
            </div>

            <select
              name="professionalId"
              value={formData.professionalId}
              onChange={(e) =>
                setFormData((s) => ({ ...s, professionalId: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Selecione um profissional</option>
              {combinedProsForSelect.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.specialty ? `- ${p.specialty}` : ''}
                </option>
              ))}
            </select>

            {showSearch && (
              <>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    value={proQuery}
                    onChange={(e) => setProQuery(e.target.value)}
                    placeholder="Digite para buscar por nome/especialidade…"
                    className="w-full py-1.5 bg-transparent outline-none text-sm"
                  />
                  {proQuery && (
                    <button
                      type="button"
                      onClick={() => setProQuery('')}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Lista só quando há texto digitado */}
                {proQuery.trim() && (
                  <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                    {isSearching ? (
                      <div className="px-3 py-2 text-sm text-gray-500">Buscando…</div>
                    ) : panelOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">Nenhum profissional encontrado</div>
                    ) : (
                      panelOptions.slice(0, 50).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pickProfessional(p)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                        >
                          <span className="font-medium text-gray-800">{p.name}</span>
                          {p.specialty ? (
                            <span className="text-gray-500"> — {p.specialty}</span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data *
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora Inicial *
              </label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora Final *
              </label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preço da Consulta (R$) *
            </label>
            <input
              type="number"
              name="defaultPrice"
              value={formData.defaultPrice}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="130.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Porcentagem da Clínica (%) *
            </label>
            <input
              type="number"
              name="clinicPercentage"
              value={formData.clinicPercentage}
              onChange={handleChange}
              min="0"
              max="100"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="20"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Clínica: {formData.clinicPercentage}% | Profissional:{' '}
              {100 - parseFloat(formData.clinicPercentage || '0')}%
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditJourneyModal;
