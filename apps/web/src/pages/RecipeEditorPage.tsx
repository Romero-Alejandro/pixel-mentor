import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconEdit,
  IconCheck,
  IconList,
  IconSparkles,
} from '@tabler/icons-react';
import type { RecipeStep } from '@pixel-mentor/shared';

import { useRecipeStore } from '@/features/recipe-management/stores/recipe.store';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAudio } from '@/contexts/AudioContext';
import { useAlert, useConfirm } from '@/hooks/useConfirmationDialogs';
import { Button, Card, Spinner, Input, Textarea, Badge } from '@/components/ui';
import { StepEditor } from '@/features/recipe-management/components/StepEditor';
import { AIRecipeGeneratorModal } from '@/features/recipe-management/components/AIRecipeGeneratorModal';
import { logger } from '@/utils/logger';

// --- Types & Constants ---

type StepType = 'content' | 'activity' | 'question' | 'intro' | 'closure';

const STEP_TYPE_LABELS: Record<StepType, string> = {
  content: 'Contenido',
  activity: 'Actividad',
  question: 'Pregunta',
  intro: 'Intro',
  closure: 'Cierre',
};

const STEP_TYPE_COLORS: Record<StepType, string> = {
  content: 'bg-sky-100 text-sky-700 border-sky-200',
  activity: 'bg-purple-100 text-purple-700 border-purple-200',
  question: 'bg-amber-100 text-amber-700 border-amber-200',
  intro: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  closure: 'bg-rose-100 text-rose-700 border-rose-200',
};

interface StepFormData {
  order: number;
  stepType: StepType;
  script?: Record<string, unknown>;
  activity?: Record<string, unknown>;
  question?: Record<string, unknown>;
}

// --- Logic Helpers (SRP) ---

const extractText = (obj: unknown): string => {
  if (typeof obj === 'string') return obj;
  if (obj && typeof obj === 'object') {
    const o = obj as { text?: string };
    if (typeof o.text === 'string') return o.text;
  }
  return '';
};

const formatStepScript = (
  stepType: string,
  script: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  if (!script) return undefined;
  if (stepType === 'activity' || stepType === 'question') return { ...script };

  const contentValue = script.content;
  const contentText = typeof contentValue === 'string' ? contentValue : extractText(contentValue);

  return {
    transition:
      typeof script.transition === 'string' ? { text: script.transition } : script.transition,
    content:
      typeof contentValue === 'string'
        ? { text: contentText, chunks: [{ text: contentText, pauseAfter: 500 }] }
        : contentValue,
    examples: Array.isArray(script.examples)
      ? script.examples.map((e) => (typeof e === 'string' ? { text: e } : e))
      : [{ text: '' }],
    closure: typeof script.closure === 'string' ? { text: script.closure } : script.closure,
  };
};

const transformAIScript = (
  stepType: string,
  script: Record<string, unknown>,
): Record<string, unknown> => {
  const getT = (val: any) => extractText(val);

  // Handle intro and closure step types - they use the full StepContent structure
  if (stepType === 'intro' || stepType === 'closure') {
    const s = script as any;

    // Sanitize chunks to ensure they match the schema (text: string, pauseAfter: number)
    const sanitizeChunks = (chunks: unknown): Array<{ text: string; pauseAfter: number }> => {
      if (!Array.isArray(chunks)) {
        return [{ text: getT(s.content) || 'Contenido', pauseAfter: 500 }];
      }
      return chunks.map((chunk: any) => ({
        text: getT(chunk?.text) || 'Contenido',
        pauseAfter: typeof chunk?.pauseAfter === 'number' ? chunk.pauseAfter : 500,
      }));
    };

    const contentValue = s.content;
    const contentText = getT(contentValue);

    return {
      transition: s.transition ? { text: getT(s.transition) || '¡Vamos!' } : { text: '¡Vamos!' },
      content: {
        text: contentText || 'Contenido',
        chunks: contentValue?.chunks
          ? sanitizeChunks(contentValue.chunks)
          : [{ text: contentText || 'Contenido', pauseAfter: 500 }],
      },
      examples: Array.isArray(s.examples)
        ? s.examples.map((e: any) => ({ text: getT(e) || 'Ejemplo' }))
        : [],
      closure: s.closure ? { text: getT(s.closure) || '¡Muy bien!' } : { text: '¡Muy bien!' },
    };
  }

  if (stepType === 'activity') {
    // Sanitize options to ensure isCorrect is boolean
    const options = (script as any).options;
    const sanitizedOptions = Array.isArray(options)
      ? options.map((opt: any) => ({
          text: getT(opt?.text) || 'Opción',
          isCorrect: typeof opt?.isCorrect === 'boolean' ? opt.isCorrect : false,
        }))
      : [
          { text: 'Opción A', isCorrect: true },
          { text: 'Opción B', isCorrect: false },
        ];

    // Ensure at least one correct option
    if (!sanitizedOptions.some((o: any) => o.isCorrect)) {
      sanitizedOptions[0].isCorrect = true;
    }

    // Sanitize feedback
    const feedback = (script as any).feedback || {};
    return {
      kind: 'activity',
      instruction: { text: getT((script as any).instruction) || 'Realiza la actividad' },
      options: sanitizedOptions,
      feedback: {
        correct: getT(feedback?.correct) || '¡Muy bien!',
        incorrect: getT(feedback?.incorrect) || 'Intenta de nuevo',
      },
    };
  }

  if (stepType === 'question') {
    const feedback = (script as any).feedback || {};
    return {
      kind: 'question',
      question: { text: getT((script as any).question) || '¿Qué aprendiste?' },
      expectedAnswer: getT((script as any).expectedAnswer) || 'Una respuesta',
      feedback: {
        correct: getT(feedback?.correct) || '¡Correcto!',
        incorrect: getT(feedback?.incorrect) || 'Pista: piensa en lo que aprendimos',
      },
    };
  }

  // content step type - also needs chunk sanitization
  const s = script as any;
  const contentText = getT(s.content);
  const contentValue = s.content;

  // Reuse the chunk sanitization logic
  const sanitizeChunksForContent = (
    chunks: unknown,
    fallbackText: string,
  ): Array<{ text: string; pauseAfter: number }> => {
    if (!Array.isArray(chunks)) {
      return [{ text: fallbackText, pauseAfter: 500 }];
    }
    return chunks.map((chunk: any) => ({
      text: getT(chunk?.text) || fallbackText,
      pauseAfter: typeof chunk?.pauseAfter === 'number' ? chunk.pauseAfter : 500,
    }));
  };

  const sanitizedExamples = Array.isArray(s.examples)
    ? s.examples.map((e: any) => ({ text: getT(e) || 'Ejemplo' }))
    : [{ text: 'Ejemplo' }];

  return {
    transition: { text: getT(s.transition) || '¡Vamos a aprender!' },
    content: {
      text: contentText || 'Contenido',
      chunks: contentValue?.chunks
        ? sanitizeChunksForContent(contentValue.chunks, contentText || 'Contenido')
        : [{ text: contentText || 'Contenido', pauseAfter: 500 }],
    },
    examples: sanitizedExamples,
    closure: { text: getT(s.closure) || '¡Muy bien!' },
  };
};

const getDisplayTitle = (step: RecipeStep): string => {
  const s = step as any;
  const target = s.script?.content || s.activity?.instruction || s.question?.question || s.title;
  const text = typeof target === 'string' ? target : extractText(target);
  return text ? text.slice(0, 50) + (text.length > 50 ? '...' : '') : `Paso ${step.order}`;
};

// --- Main Component ---

export function RecipeEditorPage() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const { playClick, playToastSuccess } = useAudio();
  const alert = useAlert();
  const confirm = useConfirm();
  const { user } = useAuth();

  const isNewRecipe = !recipeId || recipeId === 'new';
  const isTeacher = useMemo(() => user?.role === 'TEACHER' || user?.role === 'ADMIN', [user]);

  const {
    currentRecipe,
    isLoading,
    fetchRecipe,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    addStep,
    updateStep,
    deleteStep,
    reorderSteps,
  } = useRecipeStore(
    useShallow((state) => ({
      currentRecipe: state.currentRecipe,
      isLoading: state.isLoading,
      fetchRecipe: state.fetchRecipe,
      createRecipe: state.createRecipe,
      updateRecipe: state.updateRecipe,
      deleteRecipe: state.deleteRecipe,
      addStep: state.addStep,
      updateStep: state.updateStep,
      deleteStep: state.deleteStep,
      reorderSteps: state.reorderSteps,
    })),
  );

  const [form, setForm] = useState({
    title: '',
    description: '',
    expectedDuration: '',
    published: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [localSteps, setLocalSteps] = useState<RecipeStep[]>([]);
  const [stepEditor, setStepEditor] = useState<{ isOpen: boolean; step: RecipeStep | null }>({
    isOpen: false,
    step: null,
  });
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const initializedRecipeId = useRef<string | null>(null);

  useEffect(() => {
    if (!isNewRecipe && recipeId && isTeacher) fetchRecipe(recipeId);
  }, [recipeId, isTeacher, isNewRecipe, fetchRecipe]);

  // 1. Inicialización del formulario (solo cuando cambia la receta activa)
  useEffect(() => {
    if (isNewRecipe) {
      if (initializedRecipeId.current !== 'new') {
        setForm({ title: '', description: '', expectedDuration: '', published: false });
        setLocalSteps([]);
        initializedRecipeId.current = 'new';
      }
    } else if (currentRecipe && currentRecipe.id === recipeId) {
      if (initializedRecipeId.current !== recipeId) {
        const duration = currentRecipe.expectedDurationMinutes;
        const durationValue = typeof duration === 'number' ? duration.toString() : '';

        setForm({
          title: currentRecipe.title,
          description: currentRecipe.description ?? '',
          expectedDuration: durationValue,
          published: !!currentRecipe.published,
        });
        setLocalSteps((currentRecipe.steps ?? []).filter((s) => s?.id));
        initializedRecipeId.current = recipeId;
      }
    }
  }, [currentRecipe, recipeId, isNewRecipe]);

  const handleTogglePublished = () => {
    setForm((prev) => ({ ...prev, published: !prev.published }));
  };

  const handleSave = async (forcePublish?: boolean) => {
    const isPublishing = forcePublish ?? form.published;
    if (!form.title.trim()) {
      await alert({
        title: 'Campo requerido',
        message: 'El título es requerido',
        variant: 'warning',
      });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        expectedDurationMinutes: form.expectedDuration ? Number(form.expectedDuration) : undefined,
        published: isPublishing,
      };

      if (isNewRecipe) {
        const res = await createRecipe(payload);
        navigate(`/units/${res.id}/edit`, { replace: true });
      } else if (recipeId) {
        await updateRecipe(recipeId, payload);
      }

      if (forcePublish && !form.published) {
        setForm((prev) => ({ ...prev, published: true }));
      }
    } catch (err: any) {
      await alert({ title: 'Error', message: err.message || 'Error al guardar', variant: 'error' });
    } finally {
      setIsSaving(false);
      try {
        playToastSuccess();
      } catch (audioErr) {
        console.warn('[handleSave] Audio error:', audioErr);
      }
    }
  };

  const handleDeleteRecipe = async () => {
    if (!recipeId || isNewRecipe) return;
    try {
      await deleteRecipe(recipeId);
      playToastSuccess();
      navigate('/units');
    } catch (err) {
      logger.error('Delete recipe error', err);
    }
  };

  const handleSaveStep = async (stepData: StepFormData) => {
    if (!recipeId || isNewRecipe) {
      await alert({
        title: 'Atención',
        message: 'Guarda la unidad antes de añadir pasos.',
        variant: 'warning',
      });
      return;
    }
    try {
      const script = formatStepScript(stepData.stepType, stepData.script);
      const payload = { ...stepData, script };
      if (stepEditor.step) {
        await updateStep(recipeId, stepEditor.step.id, payload);
      } else {
        await addStep(recipeId, payload);
      }
      setLocalSteps(useRecipeStore.getState().currentRecipe?.steps ?? []);
      setStepEditor({ isOpen: false, step: null });
      playToastSuccess();
    } catch (err: any) {
      await alert({
        title: 'Error',
        message: err.message || 'Error al guardar paso',
        variant: 'error',
      });
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!recipeId) return;
    const confirmed = await confirm({
      title: 'Eliminar paso',
      message: '¿Estás seguro?',
      variant: 'danger',
    });
    if (confirmed) {
      try {
        await deleteStep(recipeId, stepId);
        setLocalSteps(useRecipeStore.getState().currentRecipe?.steps ?? []);
        playToastSuccess();
      } catch (err) {
        logger.error('Delete step error', err);
      }
    }
  };

  const handleMoveStep = useCallback(
    async (index: number, direction: 'up' | 'down') => {
      if (!recipeId) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= localSteps.length) return;

      playClick();
      const newSteps = [...localSteps];
      [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
      setLocalSteps(newSteps);

      try {
        await reorderSteps(
          recipeId,
          newSteps.map((s) => s.id),
        );
      } catch (err) {
        setLocalSteps(localSteps); // Revert
        logger.error('Reorder error', err);
      }
    },
    [recipeId, localSteps, reorderSteps, playClick],
  );

  const handleAIGenerated = async (draft: any) => {
    try {
      let tid = recipeId;
      if (isNewRecipe) {
        const res = await createRecipe({ ...draft, published: false });
        tid = res.id;
        navigate(`/units/${tid}/edit`, { replace: true });
      } else if (tid) {
        await updateRecipe(tid, { title: draft.title, description: draft.description });
      }
      if (!tid) return;
      const startOrder = localSteps.length + 1;
      console.log('[AI Apply] Starting to add steps:', {
        startOrder,
        stepsCount: draft.steps.length,
      });
      for (let i = 0; i < draft.steps.length; i++) {
        const stepPayload = {
          order: startOrder + i,
          stepType: draft.steps[i].stepType,
          script: transformAIScript(draft.steps[i].stepType, draft.steps[i].script),
        };
        console.log(`[AI Apply] Step ${i + 1}:`, JSON.stringify(stepPayload, null, 2));
        await addStep(tid, stepPayload);
      }
      await fetchRecipe(tid);
      playToastSuccess();
    } catch (err) {
      logger.error('AI Draft error', err);
    }
  };

  if (!isTeacher)
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center">
        <Card variant="mission" className="max-w-md text-center p-8">
          <IconList className="w-16 h-16 text-sky-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800">Acceso restringido</h2>
        </Card>
      </div>
    );

  if (isLoading && !isNewRecipe && !currentRecipe)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Spinner size="lg" className="text-sky-500" />
        <p className="font-black text-sky-600 animate-pulse">Cargando...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b-4 border-sky-200 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/units')}
              className="p-2 hover:bg-sky-50 rounded-xl transition-colors"
            >
              <IconArrowLeft className="w-6 h-6 text-sky-500" />
            </button>
            <h1 className="text-2xl font-black text-sky-700">
              {isNewRecipe ? 'Nueva Unidad' : 'Editar Unidad'}
            </h1>
            {currentRecipe ? (
              <Badge variant={form.published ? 'success' : 'warning'}>
                {form.published ? 'Publicada' : 'Borrador'}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsAIGeneratorOpen(true)} variant="secondary">
              <IconSparkles className="w-5 h-5 mr-2" /> IA
            </Button>
            {!isNewRecipe ? (
              <Button onClick={() => setShowDeleteConfirm(true)} variant="danger" size="sm">
                <IconTrash className="w-4 h-4" />
              </Button>
            ) : null}
            {!form.published && !isNewRecipe ? (
              <Button onClick={() => handleSave(true)} variant="success" isLoading={isSaving}>
                <IconCheck className="w-5 h-5 mr-2" /> Publicar
              </Button>
            ) : null}
            <Button onClick={() => handleSave()} variant="primary" isLoading={isSaving}>
              <IconCheck className="w-5 h-5 mr-2" /> Guardar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card variant="mission" className="p-6">
            <h2 className="text-xl font-black mb-4">Información</h2>
            <div className="space-y-4">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Título *"
              />
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción..."
                className="min-h-[120px]"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  value={form.expectedDuration}
                  onChange={(e) => setForm({ ...form, expectedDuration: e.target.value })}
                  placeholder="Minutos"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleTogglePublished();
                  }}
                  className={`flex items-center justify-center gap-3 px-4 py-2 rounded-xl border-2 transition-all ${form.published ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                >
                  <span className="pointer-events-none font-bold">
                    {form.published ? 'Publicada' : 'Borrador'}
                  </span>
                </button>
              </div>
            </div>
          </Card>

          <Card variant="mission" className="p-6">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <IconList className="text-sky-500" /> Pasos ({localSteps.length})
            </h2>
            <div className="space-y-3">
              {localSteps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border-2 border-slate-200 hover:border-sky-300 transition-all"
                >
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveStep(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:text-sky-500 disabled:opacity-30"
                    >
                      <IconArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveStep(index, 'down')}
                      disabled={index === localSteps.length - 1}
                      className="p-1 hover:text-sky-500 disabled:opacity-30"
                    >
                      <IconArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="w-8 h-8 flex items-center justify-center bg-sky-100 rounded-full font-bold text-sky-600">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STEP_TYPE_COLORS[step.stepType as StepType] || STEP_TYPE_COLORS.content}`}
                      >
                        {STEP_TYPE_LABELS[step.stepType as StepType] || 'Contenido'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 truncate">{getDisplayTitle(step)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStepEditor({ isOpen: true, step })}
                      className="p-2 hover:text-amber-600"
                    >
                      <IconEdit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteStep(step.id)}
                      className="p-2 hover:text-rose-600"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <Button
                onClick={() => setStepEditor({ isOpen: true, step: null })}
                variant="secondary"
                className="w-full mt-4"
              >
                <IconPlus className="w-5 h-5 mr-2" /> Añadir Paso
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="mission" className="p-6">
            <h2 className="text-lg font-black mb-4">Resumen</h2>
            <div className="space-y-3 text-sm font-medium text-slate-600">
              <div className="flex justify-between">
                <span>Pasos</span>
                <span className="text-sky-600 font-black">{localSteps.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Duración</span>
                <span className="font-black">{form.expectedDuration || 0} min</span>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <StepEditor
        isOpen={stepEditor.isOpen}
        onClose={() => setStepEditor({ isOpen: false, step: null })}
        onSave={handleSaveStep}
        step={stepEditor.step ?? undefined}
        order={stepEditor.step ? stepEditor.step.order : localSteps.length + 1}
      />

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-xl font-black mb-4">¿Eliminar unidad?</h2>
            <p className="text-slate-600 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="secondary"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={handleDeleteRecipe} variant="danger" className="flex-1">
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AIRecipeGeneratorModal
        isOpen={isAIGeneratorOpen}
        onClose={() => setIsAIGeneratorOpen(false)}
        onGenerated={handleAIGenerated}
      />
    </div>
  );
}
