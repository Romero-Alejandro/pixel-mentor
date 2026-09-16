import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  IconPencil,
  IconTemplate,
  IconSparkles,
  IconUsers,
  IconAlertCircle,
} from '@tabler/icons-react';
import type { Class, ClassTemplate } from '@pixel-mentor/shared';

import { useClassStore } from '@/features/class-management/stores/class.store';
import { AIDraftModal } from '@/features/class-management/components/AIDraftModal';
import { useAudio } from '@/contexts/AudioContext';
import { Button, Input, Textarea, Spinner } from '@/components/ui';

type CreationMode = 'blank' | 'template' | 'ai';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newClass: Class) => void | Promise<void>;
}

const MODES: { id: CreationMode; label: string; icon: typeof IconPencil; hint: string }[] = [
  {
    id: 'blank',
    label: 'Desde cero',
    icon: IconPencil,
    hint: 'Título y edades, listo en segundos',
  },
  {
    id: 'template',
    label: 'Desde plantilla',
    icon: IconTemplate,
    hint: 'Reutiliza una estructura',
  },
  { id: 'ai', label: 'Con IA', icon: IconSparkles, hint: 'Genera el plan por ti' },
];

export function CreateClassModal({ isOpen, onClose, onCreated }: CreateClassModalProps) {
  const { playClick, playErrorSubtle } = useAudio();
  const {
    createClass,
    createClassFromTemplate,
    fetchTemplates,
    templates,
    isLoading,
    error,
    clearError,
  } = useClassStore(
    useShallow((state) => ({
      createClass: state.createClass,
      createClassFromTemplate: state.createClassFromTemplate,
      fetchTemplates: state.fetchTemplates,
      templates: state.templates,
      isLoading: state.isLoading,
      error: state.error,
      clearError: state.clearError,
    })),
  );

  const [mode, setMode] = useState<CreationMode>('blank');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAgeMin, setTargetAgeMin] = useState(6);
  const [targetAgeMax, setTargetAgeMax] = useState(12);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && mode === 'template' && templates.length === 0) {
      void fetchTemplates();
    }
  }, [isOpen, mode, templates.length, fetchTemplates]);

  const handleClose = () => {
    playClick();
    setTitle('');
    setDescription('');
    setMode('blank');
    setSelectedTemplateId('');
    setAiModalOpen(false);
    clearError();
    onClose();
  };

  const finishCreation = async (newClass: Class) => {
    setTitle('');
    setMode('blank');
    setSelectedTemplateId('');
    await onCreated(newClass);
    onClose();
  };

  const handleCreateBlank = async () => {
    if (!title.trim()) {
      playErrorSubtle();
      return;
    }
    playClick();
    setIsSubmitting(true);
    try {
      const newClass = await createClass({
        title: title.trim(),
        description: description.trim() || undefined,
        targetAgeMin,
        targetAgeMax,
      });
      await finishCreation(newClass);
    } catch {
      // Error surfaced by store state
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplateId) {
      playErrorSubtle();
      return;
    }
    playClick();
    setIsSubmitting(true);
    try {
      const newClass = await createClassFromTemplate(selectedTemplateId, title.trim() || undefined);
      await finishCreation(newClass);
    } catch {
      // Error surfaced by store state
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAIGenerated = async (draft: {
    title: string;
    description: string;
    targetAgeMin?: number;
    targetAgeMax?: number;
  }) => {
    const newClass = await createClass({
      title: draft.title,
      description: draft.description || undefined,
      targetAgeMin: draft.targetAgeMin,
      targetAgeMax: draft.targetAgeMax,
    });
    await finishCreation(newClass);
  };

  if (!isOpen) return null;

  const busy = isSubmitting || isLoading;

  return (
    <>
      <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleClose} />

        <div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col border-8 border-sky-100">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b-4 border-sky-200">
            <h2 className="text-xl font-black text-slate-800">Nueva clase</h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Mode picker */}
            <div className="grid grid-cols-3 gap-3">
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      playClick();
                      setMode(m.id);
                      if (m.id === 'ai') setAiModalOpen(true);
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-4 transition-all active:scale-95 ${
                      active
                        ? 'bg-sky-50 border-sky-300 text-sky-700'
                        : 'bg-white border-slate-100 text-slate-500 hover:border-sky-200'
                    }`}
                  >
                    <Icon size={28} stroke={2.5} />
                    <span className="text-xs font-black">{m.label}</span>
                    <span className="text-[10px] font-medium text-center leading-tight opacity-70">
                      {m.hint}
                    </span>
                  </button>
                );
              })}
            </div>

            {mode === 'blank' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">
                    Título de la clase *
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Las fracciones divertidas"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">
                    Descripción (opcional)
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="¿Qué aprenderán los niños?"
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                    <IconUsers className="w-4 h-4" />
                    Rango de edad
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Input
                        type="number"
                        value={targetAgeMin}
                        onChange={(e) => setTargetAgeMin(Number(e.target.value))}
                        min={3}
                        max={18}
                      />
                      <span className="text-xs text-slate-500">Edad mínima</span>
                    </div>
                    <span className="text-slate-400 font-bold">-</span>
                    <div className="flex-1">
                      <Input
                        type="number"
                        value={targetAgeMax}
                        onChange={(e) => setTargetAgeMax(Number(e.target.value))}
                        min={3}
                        max={18}
                      />
                      <span className="text-xs text-slate-500">Edad máxima</span>
                    </div>
                  </div>
                  {targetAgeMin > targetAgeMax ? (
                    <p className="text-xs text-rose-600 mt-2 flex items-center gap-1">
                      <IconAlertCircle className="w-3 h-3" />
                      La edad mínima no puede ser mayor a la máxima
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {mode === 'template' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">
                    Título de la nueva clase
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Deja vacío para usar el nombre de la plantilla"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Plantilla *</label>
                  {templates.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-slate-400 font-bold gap-2">
                      <Spinner size="sm" /> Cargando plantillas...
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                      {templates.map((t: ClassTemplate) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            playClick();
                            setSelectedTemplateId(t.id);
                          }}
                          className={`w-full text-left p-4 rounded-2xl border-4 transition-all ${
                            selectedTemplateId === t.id
                              ? 'bg-sky-50 border-sky-300'
                              : 'bg-white border-slate-100 hover:border-sky-200'
                          }`}
                        >
                          <p className="font-black text-slate-800">{t.name}</p>
                          {t.description ? (
                            <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                              {t.description}
                            </p>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {mode === 'ai' ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                  <IconSparkles className="w-8 h-8 text-white" />
                </div>
                <p className="font-bold text-slate-600">
                  Genera una estructura de clase completa a partir de un tema y objetivos.
                </p>
                <Button onClick={() => setAiModalOpen(true)} variant="primary">
                  <IconSparkles className="w-5 h-5 mr-2" />
                  Abrir generador
                </Button>
              </div>
            ) : null}

            {error ? (
              <div className="bg-rose-100 border-2 border-rose-200 rounded-xl p-4">
                <p className="text-rose-700 font-medium text-sm">{error}</p>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          {mode !== 'ai' ? (
            <div className="p-6 border-t-4 border-sky-200 flex gap-3">
              <Button onClick={handleClose} variant="secondary" className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={mode === 'blank' ? handleCreateBlank : handleCreateFromTemplate}
                variant="primary"
                isLoading={busy}
                disabled={
                  busy ||
                  (mode === 'blank'
                    ? !title.trim() || targetAgeMin > targetAgeMax
                    : !selectedTemplateId)
                }
                className="flex-1"
              >
                Crear clase
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* AI generator nested modal */}
      <AIDraftModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onGenerated={handleAIGenerated}
      />
    </>
  );
}
