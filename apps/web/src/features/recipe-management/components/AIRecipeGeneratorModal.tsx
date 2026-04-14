import { useState } from 'react';
import {
  IconX,
  IconSparkles,
  IconCheck,
  IconAlertCircle,
  IconTarget,
  IconUsers,
  IconClock,
} from '@tabler/icons-react';

import { useAudio } from '@/contexts/AudioContext';
import { useAlert } from '@/hooks/useConfirmationDialogs';
import { Button, Input } from '@/components/ui';
import { getToken } from '@/services/api';

interface GeneratedStep {
  order: number;
  stepType: 'intro' | 'content' | 'activity' | 'closure';
  title: string;
  script: {
    transition?: { text: string };
    content?: { text: string; chunks: Array<{ text: string; pauseAfter: number }> };
    examples?: Array<{ text: string }>;
    closure?: { text: string };
    instruction?: string;
  };
}

interface GeneratedRecipeDraft {
  title: string;
  description: string;
  expectedDurationMinutes: number;
  steps: GeneratedStep[];
  qualityValidation?: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };
}

interface AIRecipeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (draft: GeneratedRecipeDraft) => Promise<void>;
}

export function AIRecipeGeneratorModal({
  isOpen,
  onClose,
  onGenerated,
}: AIRecipeGeneratorModalProps) {
  const { playModalOpen, playModalClose, playErrorSubtle, playClick } = useAudio();
  const alert = useAlert();

  const [topic, setTopic] = useState('');
  const [targetAgeMin, setTargetAgeMin] = useState(6);
  const [targetAgeMax, setTargetAgeMax] = useState(8);
  const [objectives, setObjectives] = useState<Array<{ id: string; text: string }>>([
    { id: crypto.randomUUID(), text: '' },
    { id: crypto.randomUUID(), text: '' },
    { id: crypto.randomUUID(), text: '' },
  ]);
  const [generatedDraft, setGeneratedDraft] = useState<GeneratedRecipeDraft | null>(null);
  const [generatedSteps, setGeneratedSteps] = useState<any[]>([]); // For SSE streaming
  const [generationProgress, setGenerationProgress] = useState(0); // 0-100
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [hasOpened, setHasOpened] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
    setTargetAgeMax(8);
    setObjectives([
      { id: crypto.randomUUID(), text: '' },
      { id: crypto.randomUUID(), text: '' },
      { id: crypto.randomUUID(), text: '' },
    ]);
    setGeneratedDraft(null);
    setGeneratedSteps([]);
    setGenerationProgress(0);
    setStep('form');
    onClose();
  };

  const updateObjective = (id: string, value: string) => {
    const newObjectives = objectives.map((o) => (o.id === id ? { ...o, text: value } : o));
    setObjectives(newObjectives);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      playErrorSubtle();
      return;
    }
    const validObjectives = objectives.filter((o) => o.text.trim());
    if (validObjectives.length < 3) {
      playErrorSubtle();
      return;
    }

    setIsGenerating(true);
    setGeneratedSteps([]); // Reset for streaming

    // Build SSE URL with token in query string (EventSource cannot send HTTP headers)
    // This is the standard pattern for SSE in the codebase - same as useVoice.ts
    const params = new URLSearchParams({
      topic: topic.trim(),
      targetAgeMin: String(targetAgeMin),
      targetAgeMax: String(targetAgeMax),
      objectives: validObjectives.map((obj) => obj.text.trim()).join(','),
    });

    // Add auth token to URL - EventSource cannot send custom headers
    const token = getToken();
    if (token) {
      params.set('token', token);
    }

    const eventSource = new EventSource(`/api/ai/generate-recipe/stream?${params}`);

    // Track steps and progress with local refs that persist across event calls
    const receivedDataRef = { current: { steps: [] as any[], progress: 0, complete: false } };

    // Handle step events
    eventSource.addEventListener('step', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        receivedDataRef.current.steps.push(data);
        setGeneratedSteps([...receivedDataRef.current.steps]);
      } catch (e) {
        console.error('SSE step parse error:', e);
      }
    });

    // Handle progress events
    eventSource.addEventListener('progress', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const progress = data.progress || 0;
        receivedDataRef.current.progress = progress;
        setGenerationProgress(progress);
      } catch (e) {
        console.error('SSE progress parse error:', e);
      }
    });

    // Handle completion
    eventSource.addEventListener('complete', () => {
      try {
        receivedDataRef.current.complete = true;
        // Convert steps to draft format
        const draft = {
          title: `${topic.trim()} - Unidad IA`,
          description: `Unidad educativa sobre ${topic.trim()}`,
          expectedDurationMinutes: 30,
          steps: receivedDataRef.current.steps,
          qualityValidation: { passed: true, errors: [], warnings: [] },
        };
        setGeneratedDraft(draft);
        setStep('preview');
        eventSource.close();
        setIsGenerating(false);
      } catch (e) {
        console.error('SSE complete parse error:', e);
      }
    });

    // Handle error events
    eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.error('SSE Error:', data);
        alert({
          title: 'Error',
          message: data.message || 'Error al generar la unidad',
          variant: 'error',
        });
      } catch (e) {
        console.error('SSE error parse error or connection closed:', e);
      }
      eventSource.close();
      setIsGenerating(false);
    });

    // Handle connection errors (generic onerror)
    // This fires when connection is lost, but it's normal after 'complete' event
    eventSource.onerror = (err) => {
      // Only treat as error if we haven't received any data
      if (!receivedDataRef.current.steps.length && !receivedDataRef.current.progress && !receivedDataRef.current.complete) {
        console.error('EventSource connection error:', err);
        alert({
          title: 'Error',
          message: 'Error de conexión. Intenta de nuevo.',
          variant: 'error',
        });
        setIsGenerating(false);
      }
      // Otherwise, it's expected - connection closed after stream ended
    };
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
            <h2 className="text-xl font-black text-slate-800">Generar unidad con IA</h2>
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
          {/* Loading / Streaming State */}
          {isGenerating && (
            <div className="bg-violet-50 border-2 border-violet-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <span className="font-bold text-violet-700">Generando unidad...</span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-violet-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-violet-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <p className="text-xs text-violet-600 mt-2">{generationProgress}% completado</p>
              {/* Streaming steps preview */}
              {generatedSteps.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-violet-600">Pasos generados:</p>
                  <div className="space-y-1 mt-1">
                    {generatedSteps.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-violet-500">
                        <span className="w-4 h-4 bg-violet-200 rounded-full flex items-center justify-center">
                          {i + 1}
                        </span>
                        {s.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {step === 'form' ? (
            <div className="space-y-6">
              {/* Topic */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">
                  Tema de la unidad *
                </label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ej: Sumas del 1 al 10, Las vocales, El ciclo del agua..."
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
                      key={obj.id}
                      value={obj.text}
                      onChange={(e) => updateObjective(obj.id, e.target.value)}
                      placeholder={`Objetivo ${index + 1}`}
                      className="w-full"
                    />
                  ))}
                </div>
                {objectives.filter((o) => o.text.trim()).length < 3 ? (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <IconAlertCircle className="w-3 h-3" />
                    Añade al menos 3 objetivos de aprendizaje
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Preview */}
              {generatedDraft ? (
                <>
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                    <h3 className="font-black text-emerald-700 mb-2 flex items-center gap-2">
                      <IconCheck className="w-5 h-5" />
                      Unidad generada
                    </h3>
                    <p className="text-emerald-600 font-medium">{generatedDraft.title}</p>
                    <p className="text-emerald-600 text-sm mt-1">{generatedDraft.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-emerald-500 text-sm">
                      <IconClock className="w-4 h-4" />
                      {generatedDraft.expectedDurationMinutes} minutos
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-700 mb-3">
                      Pasos propuestos ({generatedDraft.steps.length})
                    </h4>
                    <div className="space-y-2">
                      {generatedDraft.steps.map((stepItem, index) => (
                        <div
                          key={stepItem.order}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                        >
                          <div className="w-8 h-8 flex items-center justify-center bg-sky-100 rounded-full text-sm font-bold text-sky-600">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                  stepItem.stepType === 'intro'
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    : stepItem.stepType === 'content'
                                      ? 'bg-sky-100 text-sky-700 border-sky-200'
                                      : stepItem.stepType === 'activity'
                                        ? 'bg-purple-100 text-purple-700 border-purple-200'
                                        : 'bg-rose-100 text-rose-700 border-rose-200'
                                }`}
                              >
                                {stepItem.stepType === 'intro'
                                  ? 'Intro'
                                  : stepItem.stepType === 'content'
                                    ? 'Contenido'
                                    : stepItem.stepType === 'activity'
                                      ? 'Actividad'
                                      : 'Cierre'}
                              </span>
                              <span className="font-medium text-slate-800">{stepItem.title}</span>
                            </div>
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
                isLoading={isGenerating}
                disabled={!topic.trim() || objectives.filter((o) => o.text.trim()).length < 3}
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
              <Button onClick={handleApply} variant="success" isLoading={isGenerating}>
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
