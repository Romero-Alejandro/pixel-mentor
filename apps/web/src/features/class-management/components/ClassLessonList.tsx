import { useState, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconPlus,
  IconClock,
  IconEdit,
  IconExternalLink,
  IconList,
  IconSearch,
} from '@tabler/icons-react';
import { useShallow } from 'zustand/react/shallow';
import type { ClassLesson } from '@pixel-mentor/shared';

import { useAudio } from '@/contexts/AudioContext';
import { useRecipeStore } from '@/features/recipe-management/stores/recipe.store';
import { Button, Badge, Card, Modal } from '@/components/ui';
import { RecipeSelector } from '@/features/recipe-management/components';
import { logger } from '@/utils/logger';

// Helper de seguridad definitivo
const renderSafe = (val: any): string => {
  if (!val || (typeof val === 'object' && !Array.isArray(val))) return '';
  return String(val);
};

const LessonCard = memo(
  ({ lesson, index, isLast, onMoveUp, onMoveDown, onEdit, onDelete }: any) => (
    <Card
      variant="mission"
      className="group border-8 border-white bg-white shadow-gummy shadow-sky-100/50 hover:border-sky-200 transition-all p-5"
    >
      <div className="flex items-center gap-5">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="p-1 text-sky-200 hover:text-sky-500 disabled:opacity-10 transition-colors"
          >
            <IconArrowUp size={28} stroke={4} />
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={isLast}
            className="p-1 text-sky-200 hover:text-sky-500 disabled:opacity-10 transition-colors"
          >
            <IconArrowDown size={28} stroke={4} />
          </button>
        </div>

        <div className="w-14 h-14 bg-sky-100 rounded-[1.2rem] flex items-center justify-center font-black text-2xl text-sky-600 border-4 border-white shadow-md shrink-0">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black text-sky-900 truncate mb-2">
            {renderSafe(lesson.recipe?.title) || 'Unidad sin título'}
          </h3>
          <div className="flex gap-2">
            {lesson.recipe?.expectedDurationMinutes ? (
              <Badge variant="info" className="rounded-full border-2 border-sky-100 font-black">
                <IconClock size={14} stroke={3} className="mr-1" />{' '}
                {renderSafe(lesson.recipe.expectedDurationMinutes)} MIN
              </Badge>
            ) : null}
            <Badge
              variant={lesson.recipeId ? 'success' : 'warning'}
              className="rounded-full border-2 border-white font-black uppercase text-[10px]"
            >
              {lesson.recipeId ? 'Lista' : 'Sin Unidad'}
            </Badge>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onEdit(lesson)}
            className="p-4 rounded-2xl bg-amber-50 text-amber-500 border-4 border-amber-100 hover:bg-amber-100 transition-all active:scale-90"
          >
            <IconEdit size={24} stroke={3} />
          </button>
          <button
            onClick={() => onDelete(lesson)}
            className="p-4 rounded-2xl bg-rose-50 text-rose-500 border-4 border-rose-100 hover:bg-rose-100 transition-all active:scale-90"
          >
            <IconTrash size={24} stroke={3} />
          </button>
        </div>
      </div>
    </Card>
  ),
);

LessonCard.displayName = 'LessonCard';

export function ClassLessonList({
  lessons,
  onAddLesson,
  onRemoveLesson,
  onReorder,
  onEditLesson,
}: any) {
  const { playClick } = useAudio();
  const navigate = useNavigate();
  const { recipes, fetchRecipes, fetchRecipe } = useRecipeStore(
    useShallow((s) => ({
      recipes: s.recipes,
      fetchRecipes: s.fetchRecipes,
      fetchRecipe: s.fetchRecipe,
    })),
  );

  const [ui, setUi] = useState({
    selector: false,
    edit: false,
    del: false,
    current: null as ClassLesson | null,
    editId: '',
  });

  const handleMove = useCallback(
    (idx: number, dir: 'up' | 'down') => {
      playClick();
      const newOrder = [...lessons];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
      onReorder(newOrder.map((l) => l.id));
    },
    [lessons, onReorder, playClick],
  );

  const handleEditConfirm = useCallback(async () => {
    if (!ui.current || !onEditLesson) return;
    playClick();
    try {
      await onEditLesson(ui.current.id, { recipeId: ui.editId });
      setUi((p) => ({ ...p, edit: false, current: null }));
    } catch (e) {
      logger.error(e);
    }
  }, [ui.current, ui.editId, onEditLesson, playClick]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!ui.current) return;
    playClick();
    try {
      await onRemoveLesson(ui.current.id);
      setUi((p) => ({ ...p, del: false, current: null }));
    } catch (e) {
      logger.error(e);
    }
  }, [ui.current, onRemoveLesson, playClick]);

  const openEdit = useCallback(
    async (lesson: ClassLesson) => {
      playClick();
      setUi((prev) => ({ ...prev, edit: true, current: lesson, editId: lesson.recipeId ?? '' }));
      if (lesson.recipeId && !recipes.find((r) => r.id === lesson.recipeId))
        await fetchRecipe(lesson.recipeId);
      fetchRecipes();
    },
    [fetchRecipe, fetchRecipes, recipes, playClick],
  );

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === ui.editId),
    [recipes, ui.editId],
  );

  return (
    <div className="space-y-6">
      {lessons.length === 0 ? (
        <Card className="text-center py-16 border-8 border-dashed border-sky-100 bg-white/50 rounded-[3rem]">
          <IconList size={48} className="text-sky-200 mx-auto mb-4" />
          <h3 className="text-2xl font-black text-sky-800 mb-6">¡Agrega tu primera lección! ✨</h3>
          <Button onClick={() => setUi((p) => ({ ...p, selector: true }))} size="lg">
            Seleccionar Unidad
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson: any, i: number) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              index={i}
              isLast={i === lessons.length - 1}
              onMoveUp={(idx: any) => handleMove(idx, 'up')}
              onMoveDown={(idx: any) => handleMove(idx, 'down')}
              onEdit={openEdit}
              onDelete={(l: any) => setUi((p) => ({ ...p, del: true, current: l }))}
            />
          ))}
          <button
            onClick={() => setUi((p) => ({ ...p, selector: true }))}
            className="w-full py-8 rounded-[2.5rem] border-8 border-dashed border-sky-100 text-sky-300 font-black text-xl hover:bg-sky-50 transition-all flex items-center justify-center gap-4 active:scale-95"
          >
            <IconPlus size={32} stroke={4} /> AGREGAR OTRA LECCIÓN
          </button>
        </div>
      )}

      {/* --- Modales --- */}
      <RecipeSelector
        isOpen={ui.selector}
        onClose={() => setUi((p) => ({ ...p, selector: false }))}
        onSelect={(rid: any) => {
          if (ui.edit) setUi((p) => ({ ...p, editId: rid, selector: false }));
          else {
            onAddLesson(rid);
            setUi((p) => ({ ...p, selector: false }));
          }
        }}
      />

      {/* Modal de Edición */}
      <Modal
        isOpen={ui.edit}
        title="Editar Lección ✏️"
        onClose={() => setUi((p) => ({ ...p, edit: false }))}
        footer={
          <div className="flex gap-4">
            <Button
              onClick={() => setUi((p) => ({ ...p, edit: false }))}
              variant="secondary"
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleEditConfirm} variant="primary" className="flex-1">
              Guardar ✨
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <label className="text-sm font-black text-sky-900 uppercase tracking-widest ml-2 block">
            Unidad de Aprendizaje
          </label>
          {ui.editId && selectedRecipe ? (
            <div className="bg-sky-50 border-8 border-white shadow-gummy shadow-sky-100 p-6 rounded-[2rem] flex justify-between items-center">
              <div className="min-w-0 flex-1">
                <h4 className="font-black text-sky-900 text-lg truncate">
                  {renderSafe(selectedRecipe.title)}
                </h4>
                <p className="text-xs font-bold text-sky-400 uppercase mt-1">
                  {selectedRecipe.steps?.length || 0} PASOS
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setUi((p) => ({ ...p, selector: true }))}
                  className="p-3 bg-white rounded-xl text-sky-500 border-4 border-sky-100"
                >
                  <IconSearch size={20} stroke={3} />
                </button>
                <button
                  onClick={() => navigate(`/units/${ui.editId}/edit`)}
                  className="p-3 bg-white rounded-xl text-emerald-500 border-4 border-emerald-100"
                >
                  <IconExternalLink size={20} stroke={3} />
                </button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setUi((p) => ({ ...p, selector: true }))}
              variant="secondary"
              className="w-full h-20 border-4 border-dashed rounded-[1.5rem] font-black"
            >
              <IconSearch size={24} className="mr-2" /> SELECCIONAR UNIDAD
            </Button>
          )}
        </div>
      </Modal>

      {/* Modal de Borrado */}
      <Modal
        isOpen={ui.del}
        title="🗑️ ¿Borrar lección?"
        size="sm"
        onClose={() => setUi((p) => ({ ...p, del: false }))}
        footer={
          <div className="flex gap-3">
            <Button
              onClick={() => setUi((p) => ({ ...p, del: false }))}
              variant="secondary"
              className="flex-1"
            >
              No
            </Button>
            <Button onClick={handleDeleteConfirm} variant="danger" className="flex-1">
              Sí, borrar
            </Button>
          </div>
        }
      >
        <p className="font-bold text-slate-500 text-center">
          ¿Seguro que quieres quitar esta lección?
        </p>
      </Modal>
    </div>
  );
}
