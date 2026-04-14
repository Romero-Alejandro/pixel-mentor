import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconEdit,
  IconList,
  IconSparkles,
  IconDeviceFloppy,
  IconRocket,
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

// --- Helpers de Lógica ---

const extractText = (obj: unknown): string => {
  if (typeof obj === 'string') return obj;
  if (obj && typeof obj === 'object') {
    const o = obj as { text?: string };
    if (typeof o.text === 'string') return o.text;
  }
  return '';
};

const renderSafe = (val: any) => (val && typeof val === 'object' ? '' : String(val ?? ''));

const transformAIScript = (stepType: string, script: any): Record<string, unknown> => {
  const getT = (val: any) => extractText(val);

  // 🛠️ FIX DE RAÍZ: Estructura base requerida por el esquema Zod del backend
  const baseFields = {
    transition: { text: getT(script.transition) || '¡Vamos!' },
    content: {
      text: getT(script.content) || 'Contenido',
      chunks: script.content?.chunks || [
        { text: getT(script.content) || 'Contenido', pauseAfter: 500 },
      ],
    },
    examples: Array.isArray(script.examples)
      ? script.examples.map((e: any) => ({ text: getT(e) }))
      : [],
    closure: { text: getT(script.closure) || '¡Muy bien!' },
  };

  if (stepType === 'activity') {
    return {
      ...baseFields,
      kind: 'activity',
      instruction: { text: getT(script.instruction) || 'Realiza la actividad' },
      options: (script.options || []).map((o: any) => ({
        text: getT(o.text || o),
        isCorrect: typeof o.isCorrect === 'boolean' ? o.isCorrect : false,
      })),
      feedback: {
        correct: getT(script.feedback?.correct) || '¡Excelente!',
        incorrect: getT(script.feedback?.incorrect) || 'Intenta de nuevo',
      },
    };
  }

  if (stepType === 'question') {
    return {
      ...baseFields,
      kind: 'question',
      question: { text: getT(script.question) || '¿Qué aprendiste?' },
      expectedAnswer: getT(script.expectedAnswer) || 'Una respuesta',
      feedback: {
        correct: getT(script.feedback?.correct) || '¡Correcto!',
        incorrect: getT(script.feedback?.incorrect) || 'Pista: revisa lo aprendido',
      },
    };
  }

  return baseFields;
};

// --- Sub-componente de Paso (Memorizado) ---

const StepItem = memo(({ step, index, isLast, onMove, onEdit, onDelete }: any) => {
  const title = extractText(
    (step as any).script?.content ||
      (step as any).activity?.instruction ||
      (step as any).question?.question,
  );

  const colors: Record<string, string> = {
    content: 'bg-sky-100 text-sky-700 border-sky-200',
    activity: 'bg-purple-100 text-purple-700 border-purple-200',
    question: 'bg-amber-100 text-amber-700 border-amber-200',
    intro: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    closure: 'bg-rose-100 text-rose-700 border-rose-200',
  };

  return (
    <div className="group flex items-start gap-3 p-4 bg-white rounded-xl border-2 border-slate-200 hover:border-sky-300 hover:shadow-md transition-all">
      <div className="flex flex-col gap-1">
        <button
          onClick={() => onMove(index, 'up')}
          disabled={index === 0}
          className="p-1.5 rounded-lg hover:bg-sky-50 disabled:opacity-30"
        >
          <IconArrowUp size={16} />
        </button>
        <button
          onClick={() => onMove(index, 'down')}
          disabled={isLast}
          className="p-1.5 rounded-lg hover:bg-sky-50 disabled:opacity-30"
        >
          <IconArrowDown size={16} />
        </button>
      </div>
      <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-sky-100 to-sky-200 rounded-full font-bold text-sky-700 shadow-sm shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <Badge
          className={`rounded-full px-2.5 py-1 text-xs font-bold border ${colors[step.stepType] || colors.content}`}
        >
          {step.stepType.toUpperCase()}
        </Badge>
        <p className="text-sm text-slate-700 font-medium line-clamp-2 mt-1">
          {title || `Paso ${step.order}`}
        </p>
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onEdit(step)}
          className="p-2 rounded-lg hover:bg-amber-50 text-amber-600"
        >
          <IconEdit size={18} />
        </button>
        <button
          onClick={() => onDelete(step.id)}
          className="p-2 rounded-lg hover:bg-rose-50 text-rose-600"
        >
          <IconTrash size={18} />
        </button>
      </div>
    </div>
  );
});
StepItem.displayName = 'StepItem';

// --- Componente Principal ---

export function RecipeEditorPage() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const { playClick, playToastSuccess } = useAudio();
  const alert = useAlert();
  const confirm = useConfirm();

  const isNew = !recipeId || recipeId === 'new';
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
    useShallow((s) => ({
      currentRecipe: s.currentRecipe,
      isLoading: s.isLoading,
      fetchRecipe: s.fetchRecipe,
      createRecipe: s.createRecipe,
      updateRecipe: s.updateRecipe,
      deleteRecipe: s.deleteRecipe,
      addStep: s.addStep,
      updateStep: s.updateStep,
      deleteStep: s.deleteStep,
      reorderSteps: s.reorderSteps,
    })),
  );

  const [form, setForm] = useState({
    title: '',
    description: '',
    expectedDuration: '',
    published: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [stepEditor, setStepEditor] = useState<{ isOpen: boolean; step: RecipeStep | null }>({
    isOpen: false,
    step: null,
  });
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isNew && recipeId) fetchRecipe(recipeId);
  }, [recipeId, isNew, fetchRecipe]);

  useEffect(() => {
    if (isNew) setForm({ title: '', description: '', expectedDuration: '', published: false });
    else if (currentRecipe?.id === recipeId) {
      setForm({
        title: currentRecipe.title,
        description: currentRecipe.description ?? '',
        expectedDuration: renderSafe(currentRecipe.expectedDurationMinutes),
        published: !!currentRecipe.published,
      });
    }
  }, [currentRecipe, recipeId, isNew]);

  const handleSave = useCallback(
    async (publish?: boolean) => {
      if (!form.title.trim()) return alert({ title: 'Atención', message: 'Falta el título ✏️' });
      setIsSaving(true);
      try {
        const payload = {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          expectedDurationMinutes: form.expectedDuration
            ? Number(form.expectedDuration)
            : undefined,
          published: publish ?? form.published,
        };
        if (isNew) {
          const res = await createRecipe(payload);
          navigate(`/units/${res.id}/edit`, { replace: true });
        } else if (recipeId) await updateRecipe(recipeId, payload);
        if (publish !== undefined) setForm((f) => ({ ...f, published: publish }));
        playToastSuccess();
      } catch (e) {
        logger.error(e);
      } finally {
        setIsSaving(false);
      }
    },
    [form, isNew, recipeId, createRecipe, updateRecipe, navigate, alert, playToastSuccess],
  );

  const handleSaveStep = async (stepData: any) => {
    if (!recipeId || isNew)
      return alert({ title: '¡Espera!', message: 'Guarda primero la unidad ✨' });
    try {
      if (stepEditor.step) await updateStep(recipeId, stepEditor.step.id, stepData);
      else await addStep(recipeId, stepData);
      await fetchRecipe(recipeId);
      setStepEditor({ isOpen: false, step: null });
      playToastSuccess();
    } catch (e) {
      logger.error(e);
    }
  };

  const handleAIGenerated = async (draft: any) => {
    try {
      let id = recipeId;
      if (isNew) {
        const res = await createRecipe({ ...draft, published: false });
        id = res.id;
        navigate(`/units/${id}/edit`, { replace: true });
      } else if (id) await updateRecipe(id, { title: draft.title, description: draft.description });

      if (!id) return;
      for (const step of draft.steps) {
        await addStep(id, {
          order: (currentRecipe?.steps?.length || 0) + 1,
          stepType: step.stepType,
          script: transformAIScript(step.stepType, step.script),
        });
      }
      await fetchRecipe(id);
      playToastSuccess();
    } catch (e) {
      logger.error(e);
    }
  };

  const stepList = useMemo(
    () =>
      (currentRecipe?.steps || []).map((s, i) => (
        <StepItem
          key={s.id}
          step={s}
          index={i}
          isLast={i === (currentRecipe?.steps?.length || 0) - 1}
          onMove={async (idx: number, dir: any) => {
            const ids = (currentRecipe?.steps || []).map((st) => st.id);
            const target = dir === 'up' ? idx - 1 : idx + 1;
            [ids[idx], ids[target]] = [ids[target], ids[idx]];
            if (recipeId) {
              await reorderSteps(recipeId, ids);
              await fetchRecipe(recipeId);
              playClick();
            }
          }}
          onEdit={(st: any) => setStepEditor({ isOpen: true, step: st })}
          onDelete={async (sid: string) => {
            if (await confirm({ title: '¿Eliminar paso?', variant: 'danger' })) {
              if (recipeId) {
                await deleteStep(recipeId, sid);
                await fetchRecipe(recipeId);
                playToastSuccess();
              }
            }
          }}
        />
      )),
    [
      currentRecipe?.steps,
      recipeId,
      reorderSteps,
      fetchRecipe,
      confirm,
      deleteStep,
      playToastSuccess,
      playClick,
    ],
  );

  if (isLoading && !isNew && !currentRecipe)
    return (
      <div className="p-20 text-center">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b-4 border-sky-200 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/units')}
              className="p-2 hover:bg-sky-50 rounded-xl transition-colors"
            >
              <IconArrowLeft className="text-sky-500" />
            </button>
            <h1 className="text-2xl font-black text-sky-700">
              {isNew ? 'Nueva Unidad' : 'Editar Unidad'}
            </h1>
            <Badge variant={form.published ? 'success' : 'warning'}>
              {form.published ? 'Publicada' : 'Borrador'}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsAIGeneratorOpen(true)} variant="secondary">
              <IconSparkles size={20} /> IA
            </Button>
            {!isNew ? (
              <Button onClick={() => setShowDeleteConfirm(true)} variant="danger" size="sm">
                <IconTrash size={20} />
              </Button>
            ) : null}
            <Button
              onClick={() => handleSave(!form.published)}
              variant={form.published ? 'warning' : 'success'}
            >
              {form.published ? 'Despublicar' : 'Publicar'}
            </Button>
            <Button onClick={() => handleSave()} variant="primary" isLoading={isSaving}>
              <IconDeviceFloppy size={20} /> Guardar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card variant="mission" className="p-6">
            <h2 className="text-xl font-black mb-4">Información de la Unidad</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Título *</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej: Los Dinosaurios 🦖"
                  className="text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Descripción</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="¿Qué vamos a aprender hoy?"
                  className="min-h-[120px]"
                />
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-bold text-sky-700 mb-2">
                  Duración (minutos)
                </label>
                <Input
                  type="number"
                  value={form.expectedDuration}
                  onChange={(e) => setForm({ ...form, expectedDuration: e.target.value })}
                  placeholder="45"
                />
              </div>
            </div>
          </Card>

          <Card variant="mission" className="p-6">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2">
              <IconList className="text-sky-500" /> Pasos de la Unidad
            </h2>
            <div className="space-y-3">
              {currentRecipe?.steps?.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-xl">
                  <p className="text-slate-400 font-medium">Aún no hay pasos. ¡Añade el primero!</p>
                </div>
              ) : (
                stepList
              )}
              <Button
                onClick={() => setStepEditor({ isOpen: true, step: null })}
                variant="secondary"
                className="w-full mt-4 py-3 border-2 border-dashed border-sky-300 rounded-xl font-bold"
              >
                <IconPlus className="mr-2" /> Añadir Nuevo Paso
              </Button>
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card variant="mission" className="p-6 bg-white/50 border-sky-100">
            <h2 className="text-lg font-black mb-4 flex items-center gap-2">
              <IconRocket className="text-sky-500" /> Resumen
            </h2>
            <div className="space-y-4 font-bold text-slate-600">
              <div className="flex justify-between">
                <span>Pasos:</span>
                <span className="text-sky-600">{currentRecipe?.steps?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Tiempo:</span>
                <span className="text-sky-600">{form.expectedDuration || 0} min</span>
              </div>
            </div>
          </Card>
        </aside>
      </main>

      <StepEditor
        isOpen={stepEditor.isOpen}
        onClose={() => setStepEditor({ isOpen: false, step: null })}
        onSave={handleSaveStep}
        step={stepEditor.step ?? undefined}
        order={stepEditor.step ? stepEditor.step.order : (currentRecipe?.steps?.length || 0) + 1}
      />
      <AIRecipeGeneratorModal
        isOpen={isAIGeneratorOpen}
        onClose={() => setIsAIGeneratorOpen(false)}
        onGenerated={handleAIGenerated}
      />

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
          <Card className="max-w-sm w-full p-8 rounded-[2rem] text-center shadow-2xl bg-white">
            <IconTrash className="w-16 h-16 text-rose-400 mx-auto mb-4" />
            <h2 className="text-2xl font-black mb-2">¿Borrar unidad?</h2>
            <div className="flex gap-3 mt-8">
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="secondary"
                className="flex-1"
              >
                No
              </Button>
              <Button
                onClick={() => {
                  deleteRecipe(recipeId!);
                  navigate('/units');
                }}
                variant="danger"
                className="flex-1"
              >
                Sí, borrar
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
