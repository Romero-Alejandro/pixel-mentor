import { useState } from 'react';
import {
  IconX,
  IconSparkles,
  IconCheck,
  IconAlertCircle,
  IconTarget,
  IconUsers,
} from '@tabler/icons-react';
import type { GenerateClassDraftOutput } from '@pixel-mentor/shared';

import { useClassStore } from '@/stores/classStore';
import { useAudio } from '@/contexts/AudioContext';
import { Button, Input } from '@/components/ui';

interface AIDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (draft: GenerateClassDraftOutput) => Promise<void>;
}

export function AIDraftModal({ isOpen, onClose, onGenerated }: AIDraftModalProps) {
  const { playClick, playModalOpen, playModalClose, playErrorSubtle } = useAudio();
  const { generateClassDraft, isLoading, error } = useClassStore();

  const [topic, setTopic] = useState('');
  const [targetAgeMin, setTargetAgeMin] = useState(6);
  const [targetAgeMax, setTargetAgeMax] = useState(12);
  const [objectives, setObjectives] = useState<string[]>(['', '', '']);
  const [generatedDraft, setGeneratedDraft] = useState<GenerateClassDraftOutput | null>(null);
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [hasOpened, setHasOpened] = useState(false);

  // Play open sound on mount
  if (isOpen && !hasOpened) {
    setHasOpened(true);
    playModalOpen();
  }

  const handleClose = () => {
    playModalClose();
    // Reset state
    setTopic('');
    setTargetAgeMin(6);
    setTargetAgeMax(12);
    setObjectives(['', '', '']);
    setGeneratedDraft(null);
    setStep('form');
    onClose();
  };

  const updateObjective = (index: number, value: string) => {
    const newObjectives = [...objectives];
    newObjectives[index] = value;
    setObjectives(newObjectives);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      playErrorSubtle();
      return;
    }
    const validObjectives = objectives.filter((o) => o.trim());
    if (validObjectives.length < 3) {
      playErrorSubtle();
      return;
    }

    try {
      const draft = await generateClassDraft({
        topic: topic.trim(),
        targetAgeMin,
        targetAgeMax,
        objectives: validObjectives,
      });
      setGeneratedDraft(draft);
      setStep('preview');
    } catch {
      // Error handled in store
    }
  };

  const handleApply = async () => {
    if (!generatedDraft) return;
    playClick();
    await onGenerated(generatedDraft);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-4 border-sky-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
              <IconSparkles className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-black text-slate-800">Generar clase con IA</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <IconX className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'form' ? (
            <div className="space-y-6">
              {/* Topic */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">
                  Tema de la clase *
                </label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ej: El sistema solar, las vocales, sumas básicas..."
                  className="w-full"
                />
              </div>

              {/* Age range */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                  <IconUsers className="w-4 h-4" />
                  Rango de edad *
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      type="number"
                      value={targetAgeMin}
                      onChange={(e) => setTargetAgeMin(Number(e.target.value))}
                      min={3}
                      max={18}
                      className="w-full"
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
                      className="w-full"
                    />
                    <span className="text-xs text-slate-500">Edad máxima</span>
                  </div>
                </div>
              </div>

              {/* Objectives */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-2">
                  <IconTarget className="w-4 h-4" />
                  Objetivos de aprendizaje (mínimo 3) *
                </label>
                <div className="space-y-2">
                  {objectives.map((obj, index) => (
                    <Input
                      key={index}
                      value={obj}
                      onChange={(e) => updateObjective(index, e.target.value)}
                      placeholder={`Objetivo ${index + 1}`}
                      className="w-full"
                    />
                  ))}
                </div>
                {objectives.filter((o) => o.trim()).length < 3 ? (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <IconAlertCircle className="w-3 h-3" />
                    Añade al menos 3 objetivos de aprendizaje
                  </p>
                ) : null}
              </div>

              {/* Error display */}
              {error ? (
                <div className="bg-rose-100 border-2 border-rose-200 rounded-xl p-4">
                  <p className="text-rose-700 font-medium text-sm">{error}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Preview */}
              {generatedDraft ? (
                <>
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                    <h3 className="font-black text-emerald-700 mb-2 flex items-center gap-2">
                      <IconCheck className="w-5 h-5" />
                      Estructura generada
                    </h3>
                    <p className="text-emerald-600 font-medium">{generatedDraft.title}</p>
                    <p className="text-emerald-600 text-sm mt-1">{generatedDraft.description}</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-700 mb-3">
                      Lecciones propuestas ({generatedDraft.lessons.length})
                    </h4>
                    <div className="space-y-2">
                      {generatedDraft.lessons.map((lesson, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                        >
                          <div className="w-8 h-8 flex items-center justify-center bg-sky-100 rounded-full text-sm font-bold text-sky-600">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-800">{lesson.title}</p>
                            {lesson.duration ? (
                              <p className="text-xs text-slate-500">{lesson.duration} min</p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quality warnings */}
                  {generatedDraft.qualityValidation && !generatedDraft.qualityValidation.passed ? (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                      <h4 className="font-bold text-amber-700 mb-2 flex items-center gap-2">
                        <IconAlertCircle className="w-5 h-5" />
                        Advertencias de calidad
                      </h4>
                      <ul className="text-sm text-amber-700 space-y-1">
                        {generatedDraft.qualityValidation.warnings.map((w, i) => (
                          <li key={i}>• {w}</li>
                        ))}
                        {generatedDraft.qualityValidation.errors.map((e, i) => (
                          <li key={i} className="text-rose-700">
                            • {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t-4 border-sky-200 flex gap-3">
          {step === 'form' ? (
            <>
              <Button onClick={handleClose} variant="secondary" className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleGenerate}
                variant="primary"
                isLoading={isLoading}
                disabled={!topic.trim() || objectives.filter((o) => o.trim()).length < 3}
                className="flex-1"
              >
                <IconSparkles className="w-5 h-5 mr-2" />
                Generar
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setStep('form')} variant="secondary" className="flex-1">
                <IconX className="w-5 h-5 mr-2" />
                Modificar
              </Button>
              <Button onClick={handleApply} variant="success" isLoading={isLoading}>
                <IconCheck className="w-5 h-5 mr-2" />
                Aplicar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
