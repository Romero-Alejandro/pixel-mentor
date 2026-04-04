import { useEffect, useState } from 'react';
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
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useAudio } from '@/contexts/AudioContext';
import { useAlert, useConfirm } from '@/hooks/useConfirmationDialogs';
import { Button, Card, Spinner, Input, Textarea, Badge } from '@/components/ui';
import { StepEditor } from '@/features/recipe-management/components/StepEditor';
import { AIRecipeGeneratorModal } from '@/features/recipe-management/components/AIRecipeGeneratorModal';
import { logger } from '@/utils/logger';

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

/**
 * Transform frontend StepEditor script format to backend API format.
 * Frontend sends simple strings, backend expects structured objects.
 */
function transformStepScript(
  stepType: string,
  script: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!script) return undefined;

  // For activity and question types, preserve the original structure
  if (stepType === 'activity' || stepType === 'question') {
    return script;
  }

  // For content types, transform simple strings to objects
  return {
    transition:
      typeof script.transition === 'string' ? { text: script.transition } : script.transition,
    content:
      typeof script.content === 'string'
        ? { text: script.content, chunks: [{ text: script.content, pauseAfter: 500 }] }
        : script.content,
    examples: Array.isArray(script.examples)
      ? script.examples.map((e) => (typeof e === 'string' ? { text: e } : e))
      : [{ text: '' }],
    closure: typeof script.closure === 'string' ? { text: script.closure } : script.closure,
  };
}

export function RecipeEditorPage() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const { playClick, playToastSuccess } = useAudio();
  const alert = useAlert();
  const confirm = useConfirm();
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));

  const {
    currentRecipe,
    isLoading,
    error,
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
      error: state.error,
      fetchRecipe: state.fetchRecipe,
      createRecipe: state.createRecipe,
      updateRecipe: state.updateRecipe,
      deleteRecipe: state.deleteRecipe,
      addStep: state.addStep,
      updateStep: state.updateStep,
      deleteStep: state.deleteStep,
      reorderSteps: state.reorderSteps,
      clearError: state.clearError,
    })),
  );

  const isNewRecipe = !recipeId || recipeId === 'new';

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expectedDuration, setExpectedDuration] = useState<string>('');
  const [published, setPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localSteps, setLocalSteps] = useState<RecipeStep[]>([]);

  // Step editor modal
  const [isStepEditorOpen, setIsStepEditorOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<RecipeStep | null>(null);

  // AI Generator modal
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Handler para aplicar draft generado por IA
  const handleAIGenerated = async (draft: {
    title: string;
    description: string;
    expectedDurationMinutes: number;
    steps: Array<{
      order: number;
      stepType: string;
      title: string;
      script: Record<string, unknown>;
    }>;
  }) => {
    // Transformar el script de IA al formato que espera el backend
    const transformScript = (
      stepType: string,
      script: Record<string, unknown>,
    ): Record<string, unknown> => {
      const getText = (obj: unknown): string => {
        if (typeof obj === 'string') return obj;
        if (obj && typeof obj === 'object') {
          const o = obj as { text?: string };
          if (typeof o.text === 'string') return o.text;
        }
        return '';
      };

      // Para activity - incluir options
      if (stepType === 'activity') {
        const instructionText = getText((script as { instruction?: unknown }).instruction);
        const optionsArr = (script as { options?: unknown[] }).options;

        return {
          kind: 'activity',
          instruction: { text: instructionText || 'Realiza la actividad' },
          options:
            optionsArr && Array.isArray(optionsArr)
              ? optionsArr.map((opt) => {
                  const optObj = opt as { text?: string; isCorrect?: boolean };
                  return {
                    text: optObj.text || '',
                    isCorrect: Boolean(optObj.isCorrect),
                  };
                })
              : [
                  { text: 'Opción A', isCorrect: true },
                  { text: 'Opción B', isCorrect: false },
                ],
          feedback: {
            correct: '¡Muy bien!',
            incorrect: 'Intenta de nuevo',
          },
        };
      }

      // Para question
      if (stepType === 'question') {
        const questionText = getText((script as { question?: unknown }).question);
        const expectedAnswer = getText((script as { expectedAnswer?: unknown }).expectedAnswer);

        return {
          kind: 'question',
          question: { text: questionText || '¿Qué aprendiste?' },
          expectedAnswer: expectedAnswer || 'Una respuesta',
          feedback: {
            correct: '¡Correcto!',
            incorrect: 'Pista: piensa en lo que aprendimos',
          },
        };
      }

      // Para content, intro, closure - formato completo
      const transitionText = getText((script as { transition?: unknown }).transition);
      const contentObj = (script as { content?: unknown }).content;
      const contentText = getText(contentObj);
      const examplesArr = (script as { examples?: unknown[] }).examples;
      const closureText = getText((script as { closure?: unknown }).closure);

      return {
        transition: { text: transitionText || '¡Vamos a aprender!' },
        content: {
          text: contentText,
          chunks: [{ text: contentText, pauseAfter: 500 }],
        },
        examples:
          examplesArr && Array.isArray(examplesArr) && examplesArr.length > 0
            ? examplesArr.map((e) => ({ text: getText(e) }))
            : [{ text: 'Ejemplo' }],
        closure: { text: closureText || '¡Muy bien! Has completado este paso.' },
      };
    };

    // Obtener el order máximo actual de los pasos existentes
    const getMaxOrder = (): number => {
      if (currentRecipe && currentRecipe.steps && currentRecipe.steps.length > 0) {
        return Math.max(...currentRecipe.steps.map((s) => s.order || 0));
      }
      return 0;
    };

    // Primero guardamos la unidad base si es nueva
    if (isNewRecipe) {
      const newRecipe = await createRecipe({
        title: draft.title,
        description: draft.description,
        expectedDurationMinutes: draft.expectedDurationMinutes,
        published: false,
      });
      // Navegamos al editor con la nueva unidad
      navigate(`/units/${newRecipe.id}/edit`, { replace: true });
      // Cargamos los steps generados (empezando desde order 1)
      let order = 1;
      for (const stepData of draft.steps) {
        await addStep(newRecipe.id, {
          order: order++,
          stepType: stepData.stepType as 'content' | 'activity' | 'question' | 'intro' | 'closure',
          script: transformScript(stepData.stepType, stepData.script),
        });
      }
      playToastSuccess();
    } else if (recipeId) {
      // Si ya existe, actualizamos y agregamos los steps
      await updateRecipe(recipeId, {
        title: draft.title,
        description: draft.description,
        expectedDurationMinutes: draft.expectedDurationMinutes,
      });
      // Obtener el order máximo actual y continuar desde ahí
      const startOrder = getMaxOrder() + 1;
      let order = startOrder;
      for (const stepData of draft.steps) {
        await addStep(recipeId, {
          order: order++,
          stepType: stepData.stepType as 'content' | 'activity' | 'question' | 'intro' | 'closure',
          script: transformScript(stepData.stepType, stepData.script),
        });
      }
      // Recargamos la unidad
      await fetchRecipe(recipeId);
      playToastSuccess();
    }
  };

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  // Load recipe if editing
  useEffect(() => {
    if (!isNewRecipe && recipeId && isTeacher) {
      fetchRecipe(recipeId);
    }
  }, [recipeId, isTeacher, isNewRecipe, fetchRecipe]);

  // Set form state when recipe loads
  useEffect(() => {
    if (currentRecipe && !isNewRecipe) {
      setTitle(currentRecipe.title);
      setDescription(currentRecipe.description ?? '');
      setExpectedDuration(currentRecipe.expectedDurationMinutes?.toString() ?? '');
      setPublished(currentRecipe.published);
      setLocalSteps(currentRecipe.steps ?? []);
    } else if (isNewRecipe) {
      setTitle('');
      setDescription('');
      setExpectedDuration('');
      setPublished(false);
      setLocalSteps([]);
    }
  }, [currentRecipe, isNewRecipe]);

  const handleSave = async () => {
    if (!title.trim()) {
      await alert({
        title: 'Campo requerido',
        message: 'El título es requerido',
        variant: 'warning',
      });
      return;
    }

    setIsSaving(true);
    try {
      if (isNewRecipe) {
        const newRecipe = await createRecipe({
          title: title.trim(),
          description: description.trim() || undefined,
          expectedDurationMinutes: expectedDuration ? Number(expectedDuration) : undefined,
          published,
        });
        playToastSuccess();
        navigate(`/units/${newRecipe.id}/edit`, { replace: true });
      } else if (recipeId) {
        await updateRecipe(recipeId, {
          title: title.trim(),
          description: description.trim() || undefined,
          expectedDurationMinutes: expectedDuration ? Number(expectedDuration) : undefined,
          published,
        });
        playToastSuccess();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar la unidad';
      await alert({ title: 'Error', message, variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recipeId || isNewRecipe) return;
    try {
      await deleteRecipe(recipeId);
      playToastSuccess();
      navigate('/units');
    } catch {
      // Error handled in store
    }
  };

  const handleAddStep = () => {
    setEditingStep(null);
    setIsStepEditorOpen(true);
  };

  const handleEditStep = (step: RecipeStep) => {
    setEditingStep(step);
    setIsStepEditorOpen(true);
  };

  const handleSaveStep = async (stepData: StepFormData) => {
    if (!recipeId || recipeId === 'new') {
      await alert({
        title: 'Guarda primero',
        message: 'Primero debes guardar la unidad antes de agregar pasos.',
        variant: 'warning',
      });
      return;
    }

    if (!currentRecipe) {
      await alert({
        title: 'Error',
        message: 'La unidad no está cargada. Intenta recargar la página.',
        variant: 'error',
      });
      return;
    }

    try {
      const transformedScript = transformStepScript(stepData.stepType, stepData.script);

      if (editingStep) {
        // Update existing step
        await updateStep(recipeId, editingStep.id, {
          order: stepData.order,
          stepType: stepData.stepType,
          script: transformedScript,
          activity: stepData.activity,
          question: stepData.question,
        });
      } else {
        // Add new step
        await addStep(recipeId, {
          order: stepData.order,
          stepType: stepData.stepType,
          script: transformedScript,
          activity: stepData.activity,
          question: stepData.question,
        });
      }
      // Refresh local state from updated store
      const updatedRecipe = useRecipeStore.getState().currentRecipe;
      if (updatedRecipe) {
        setLocalSteps(updatedRecipe.steps ?? []);
      }
      playToastSuccess();
    } catch (err) {
      let message = 'Error al guardar el paso';

      // Extract error message from API response
      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response?: { data?: { message?: string; error?: string } } })
          .response;
        if (response?.data?.message) {
          message = response.data.message;
        } else if (response?.data?.error) {
          message = response.data.error;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }

      await alert({ title: 'Error', message, variant: 'error' });
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!recipeId) return;
    if (
      await confirm({
        title: 'Confirmar eliminación',
        message: '¿Estás seguro de que quieres eliminar este paso?',
        variant: 'danger',
      })
    ) {
      try {
        await deleteStep(recipeId, stepId);
        playToastSuccess();
      } catch {
        // Error handled in store
      }
    }
  };

  const handleMoveStepUp = (index: number) => {
    if (index === 0 || !recipeId) return;
    playClick();
    const newSteps = [...localSteps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    setLocalSteps(newSteps);
    const stepIds = newSteps.map((s) => s.id);
    logger.debug('[RecipeEditor] handleMoveStepUp stepIds:', stepIds);
    reorderSteps(recipeId, stepIds).catch(async (err) => {
      console.error('[handleMoveStepUp] Error:', err);
      // Revert on error
      setLocalSteps(localSteps);
      await alert({
        title: 'Error al reordenar',
        message: 'Error al reordernar: ' + (err?.response?.data?.message || err.message),
        variant: 'error',
      });
    });
  };

  const handleMoveStepDown = (index: number) => {
    if (index === localSteps.length - 1 || !recipeId) return;
    playClick();
    const newSteps = [...localSteps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    setLocalSteps(newSteps);
    const stepIds = newSteps.map((s) => s.id);
    logger.debug('[RecipeEditor] handleMoveStepDown stepIds:', stepIds);
    reorderSteps(recipeId, stepIds).catch(async (err) => {
      console.error('[handleMoveStepDown] Error:', err);
      // Revert on error
      setLocalSteps(localSteps);
      await alert({
        title: 'Error al reordenar',
        message: 'Error al reordernar: ' + (err?.response?.data?.message || err.message),
        variant: 'error',
      });
    });
  };

  const getStepTitle = (step: RecipeStep): string => {
    const script = step as unknown as { script?: { content?: string | { text?: string } } };
    const activity = step as unknown as { activity?: { instruction?: string } };
    const question = step as unknown as { question?: { question?: string } };

    if (script.script?.content) {
      const text =
        typeof script.script.content === 'string'
          ? script.script.content
          : script.script.content.text || '';
      return text.slice(0, 50) + (text.length > 50 ? '...' : '');
    }
    if (activity.activity?.instruction) {
      return (
        activity.activity.instruction.slice(0, 50) +
        (activity.activity.instruction.length > 50 ? '...' : '')
      );
    }
    if (question.question?.question) {
      return (
        question.question.question.slice(0, 50) +
        (question.question.question.length > 50 ? '...' : '')
      );
    }
    return `Paso ${step.order}`;
  };

  if (!isTeacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card variant="mission" className="max-w-md text-center p-8">
          <IconList className="w-16 h-16 text-sky-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">Acceso restringido</h2>
          <p className="text-slate-500 font-medium">
            Solo los tutores pueden acceder al editor de unidads.
          </p>
        </Card>
      </div>
    );
  }

  if (isLoading && !isNewRecipe && !currentRecipe) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center gap-4">
        <Spinner size="lg" className="text-sky-500" />
        <p className="text-lg font-black text-sky-600 animate-pulse">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b-4 border-sky-200 shadow-gummy shadow-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/units')}
              className="p-2 rounded-xl hover:bg-sky-50 transition-colors"
            >
              <IconArrowLeft className="w-6 h-6 text-sky-500" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-sky-700">
                  {isNewRecipe ? 'Nueva Unidad' : 'Editar Unidad'}
                </h1>
                {currentRecipe ? (
                  <Badge variant={published ? 'success' : 'warning'}>
                    {published ? 'Publicada' : 'Borrador'}
                  </Badge>
                ) : null}
              </div>
              {!isNewRecipe && currentRecipe ? (
                <p className="text-sm text-slate-500">Versión {currentRecipe.version}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsAIGeneratorOpen(true)} variant="secondary" className="flex">
              <IconSparkles className="w-5 h-5 mr-2" />
              Generar con IA
            </Button>
            {!isNewRecipe ? (
              <Button onClick={() => setShowDeleteConfirm(true)} variant="danger" size="sm">
                <IconTrash className="w-4 h-4 mr-1.5" />
                Eliminar
              </Button>
            ) : null}
            <Button onClick={handleSave} variant="primary" isLoading={isSaving}>
              <IconCheck className="w-5 h-5 mr-2" />
              Guardar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error display */}
        {error ? (
          <div className="mb-6 bg-rose-100 border-4 border-rose-200 rounded-2xl p-4">
            <p className="text-rose-700 font-bold">{error}</p>
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Description */}
            <Card variant="mission" className="p-6">
              <h2 className="text-xl font-black text-slate-800 mb-4">Información de la unidad</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Título *</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título de la unidad"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Descripción</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descripción de la unidad..."
                    className="w-full min-h-[120px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">
                      Duración esperada (minutos)
                    </label>
                    <Input
                      type="number"
                      value={expectedDuration}
                      onChange={(e) => setExpectedDuration(e.target.value)}
                      placeholder="Duración en minutos"
                      className="w-full"
                      min={1}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => setPublished(!published)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                        published
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <div
                        className={`w-10 h-6 rounded-full transition-colors relative ${
                          published ? 'bg-emerald-400' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            published ? 'translate-x-[18px]' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                      <span className="text-sm font-bold">
                        {published ? 'Publicada' : 'Borrador'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Steps */}
            <Card variant="mission" className="p-6">
              <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                <IconList className="w-6 h-6 text-sky-500" />
                Pasos ({localSteps.length})
              </h2>

              {localSteps.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 font-medium mb-4">No hay pasos aún</p>
                  <Button onClick={handleAddStep} variant="primary">
                    <IconPlus className="w-5 h-5 mr-2" />
                    Añadir Primer Paso
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {localSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border-2 border-slate-200 hover:border-sky-300 transition-colors"
                    >
                      {/* Reorder controls */}
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => handleMoveStepUp(index)}
                          disabled={index === 0}
                          className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all"
                          title="Mover arriba"
                        >
                          <IconArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveStepDown(index)}
                          disabled={index === localSteps.length - 1}
                          className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all"
                          title="Mover abajo"
                        >
                          <IconArrowDown className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Order number */}
                      <div className="w-8 h-8 flex items-center justify-center bg-sky-100 rounded-full text-sm font-bold text-sky-600 shrink-0">
                        {index + 1}
                      </div>

                      {/* Step info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              STEP_TYPE_COLORS[
                                (step as unknown as { stepType?: StepType }).stepType || 'content'
                              ]
                            }`}
                          >
                            {
                              STEP_TYPE_LABELS[
                                (step as unknown as { stepType?: StepType }).stepType || 'content'
                              ]
                            }
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{step.atomId}</span>
                        </div>
                        <p className="text-sm text-slate-600 truncate">{getStepTitle(step)}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleEditStep(step)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                          title="Editar paso"
                        >
                          <IconEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStep(step.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Eliminar paso"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add step button */}
                  <Button onClick={handleAddStep} variant="secondary" className="w-full mt-4">
                    <IconPlus className="w-5 h-5 mr-2" />
                    Añadir Paso
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary */}
            <Card variant="mission" className="p-6">
              <h2 className="text-lg font-black text-slate-800 mb-4">Resumen</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Pasos</span>
                  <span className="text-2xl font-black text-sky-600">{localSteps.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Duración</span>
                  <span className="text-xl font-black text-slate-600">
                    {expectedDuration ? `${expectedDuration} min` : '-'}
                  </span>
                </div>
                {!isNewRecipe && currentRecipe ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Versión</span>
                    <span className="text-xl font-black text-slate-600">
                      v{currentRecipe.version}
                    </span>
                  </div>
                ) : null}
              </div>
            </Card>

            {/* Help */}
            <Card variant="mission" className="p-6 bg-sky-50">
              <h2 className="text-lg font-black text-sky-800 mb-3">¿Necesitas ayuda?</h2>
              <p className="text-sky-600 font-medium text-sm mb-3">
                Las unidads son plantillas que definen la estructura de una clase.
              </p>
              <p className="text-sky-600 font-medium text-sm">
                Cada paso puede contener contenido, actividades interactivas o preguntas.
              </p>
            </Card>
          </div>
        </div>
      </main>

      {/* Step Editor Modal */}
      <StepEditor
        isOpen={isStepEditorOpen}
        onClose={() => {
          setIsStepEditorOpen(false);
          setEditingStep(null);
        }}
        onSave={handleSaveStep}
        step={editingStep ?? undefined}
        order={editingStep ? editingStep.order : localSteps.length + 1}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl p-6">
            <h2 className="text-xl font-black text-slate-800 mb-4">Confirmar eliminación</h2>
            <p className="text-slate-600 font-medium mb-6">
              ¿Estás seguro de que deseas eliminar la unidad{' '}
              <span className="font-bold text-slate-800">"{title}"</span>?
              <br />
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="secondary"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={handleDelete} variant="danger" className="flex-1">
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* AI Generator Modal */}
      <AIRecipeGeneratorModal
        isOpen={isAIGeneratorOpen}
        onClose={() => setIsAIGeneratorOpen(false)}
        onGenerated={handleAIGenerated}
      />
    </div>
  );
}
