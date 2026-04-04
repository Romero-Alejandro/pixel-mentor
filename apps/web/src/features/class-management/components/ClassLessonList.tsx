import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconPlus,
  IconClock,
  IconEdit,
  IconX,
  IconCheck,
  IconExternalLink,
  IconList,
  IconSearch,
} from '@tabler/icons-react';
import { useShallow } from 'zustand/react/shallow';
import type { ClassLesson, Recipe } from '@pixel-mentor/shared';

import { useAudio } from '@/contexts/AudioContext';
import { useRecipeStore } from '@/features/recipe-management/stores/recipe.store';
import { Button, Badge, Card, Modal } from '@/components/ui';
import { RecipeSelector } from '@/features/recipe-management/components';

interface ClassLessonListProps {
  lessons: ClassLesson[];
  onAddLesson: (recipeId: string) => void;
  onRemoveLesson: (lessonId: string) => void;
  onReorder: (lessonIds: string[]) => void;
  onEditLesson?: (lessonId: string, data: { recipeId: string }) => void;
}

export function ClassLessonList({
  lessons,
  onAddLesson,
  onRemoveLesson,
  onReorder,
  onEditLesson,
}: ClassLessonListProps) {
  const { playClick } = useAudio();
  const navigate = useNavigate();

  // Recipe store for fetching selected recipe details
  const { recipes, fetchRecipes } = useRecipeStore(
    useShallow((state) => ({
      recipes: state.recipes,
      fetchRecipes: state.fetchRecipes,
    })),
  );

  // Recipe selector modal state
  const [isRecipeSelectorOpen, setIsRecipeSelectorOpen] = useState(false);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<ClassLesson | null>(null);
  const [editRecipeId, setEditRecipeId] = useState('');

  // Delete confirmation modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState<ClassLesson | null>(null);

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    playClick();
    const newOrder = [...lessons];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    onReorder(newOrder.map((l) => l.id));
  };

  const handleMoveDown = (index: number) => {
    if (index === lessons.length - 1) return;
    playClick();
    const newOrder = [...lessons];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    onReorder(newOrder.map((l) => l.id));
  };

  const { fetchRecipe } = useRecipeStore(
    useShallow((state) => ({
      fetchRecipe: state.fetchRecipe,
    })),
  );

  const handleEditClick = async (lesson: ClassLesson) => {
    playClick();
    setEditingLesson(lesson);
    setEditRecipeId(lesson.recipeId ?? '');
    setIsEditModalOpen(true);

    // If lesson has a recipeId, fetch the recipe details for preview
    if (lesson.recipeId) {
      // Check if recipe is already in cache
      const cachedRecipe = recipes.find((r) => r.id === lesson.recipeId);
      if (!cachedRecipe) {
        // Fetch recipe details if not in cache
        await fetchRecipe(lesson.recipeId);
      }
    }
    // Also fetch all recipes for the selector
    fetchRecipes();
  };

  const handleOpenRecipeSelector = () => {
    playClick();
    setIsRecipeSelectorOpen(true);
    fetchRecipes();
  };

  const handleSelectRecipe = (recipeId: string) => {
    // If editing a lesson, update the edit state instead of creating new
    if (isEditModalOpen && editingLesson) {
      setEditRecipeId(recipeId);
      setIsRecipeSelectorOpen(false);
      return;
    }
    // Otherwise, create new lesson
    onAddLesson(recipeId);
    setIsRecipeSelectorOpen(false);
  };

  const handleClearRecipe = () => {
    playClick();
    setEditRecipeId('');
  };

  const handleViewRecipe = () => {
    if (editRecipeId) {
      navigate(`/units/${editRecipeId}/edit`);
    }
  };

  // Get the selected recipe for preview
  const selectedRecipe: Recipe | undefined = editRecipeId
    ? recipes.find((r) => r.id === editRecipeId)
    : undefined;

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingLesson(null);
    setEditRecipeId('');
  };

  const handleSaveEdit = async () => {
    if (!editingLesson || !onEditLesson) return;
    playClick();
    const updateData: { recipeId: string } = {
      recipeId: editRecipeId.trim(),
    };
    await onEditLesson(editingLesson.id, updateData);
    handleCloseEditModal();
  };

  const handleDeleteClick = (lesson: ClassLesson) => {
    playClick();
    setLessonToDelete(lesson);
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setLessonToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!lessonToDelete || !onRemoveLesson) return;
    playClick();
    await onRemoveLesson(lessonToDelete.id);
    handleCloseDeleteModal();
  };

  // Recipe Selector Modal - always rendered so it works in empty state too
  const recipeSelectorModal = (
    <RecipeSelector
      isOpen={isRecipeSelectorOpen}
      onClose={() => setIsRecipeSelectorOpen(false)}
      onSelect={handleSelectRecipe}
    />
  );

  if (lessons.length === 0) {
    return (
      <>
        <div className="text-center py-12">
          {/* Empty state illustration */}
          <div className="w-20 h-20 mx-auto mb-4 bg-sky-100 rounded-3xl flex items-center justify-center">
            <IconList className="w-10 h-10 text-sky-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Agrega tu primera lección</h3>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            Las lecciones usan{' '}
            <span className="font-semibold text-sky-600">unidades de aprendizaje</span> como
            contenido. Primero crea una unidad, luego asígnala a esta clase.
          </p>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-3 mb-6 text-sm">
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl border-2 border-emerald-200">
              <IconCheck className="w-4 h-4" />
              <span className="font-semibold">Crear clase</span>
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-2 px-3 py-2 bg-sky-50 text-sky-700 rounded-xl border-2 border-sky-300 animate-pulse">
              <IconPlus className="w-4 h-4" />
              <span className="font-semibold">Agregar lección</span>
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-400 rounded-xl border-2 border-slate-200">
              <span className="font-semibold">Publicar</span>
            </div>
          </div>

          <Button onClick={handleOpenRecipeSelector} variant="primary" size="lg">
            <IconPlus className="w-5 h-5 mr-2" />
            Seleccionar Unidad
          </Button>
        </div>
        {recipeSelectorModal}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Lesson list */}
      <div className="space-y-3">
        {lessons.map((lesson, index) => (
          <Card
            key={lesson.id}
            variant="mission"
            className="group hover:border-sky-300 hover:shadow-gummy hover:shadow-sky-200 transition-all duration-200"
          >
            <div className="flex items-start gap-4">
              {/* Reorder controls */}
              <div className="flex flex-col items-center gap-1 pt-1">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all"
                  title="Mover arriba"
                >
                  <IconArrowUp className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === lessons.length - 1}
                  className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all"
                  title="Mover abajo"
                >
                  <IconArrowDown className="w-5 h-5" />
                </button>
              </div>

              {/* Order number */}
              <div className="w-10 h-10 flex items-center justify-center bg-sky-100 rounded-full text-base font-bold text-sky-600 shrink-0">
                {index + 1}
              </div>

              {/* Lesson info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-800 truncate mb-2">
                  {lesson.recipe?.title ?? 'Sin receta'}
                </h3>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Duration badge */}
                  {lesson.recipe?.expectedDurationMinutes ? (
                    <Badge variant="info" className="gap-1.5">
                      <IconClock className="w-3 h-3" />
                      <span>{lesson.recipe.expectedDurationMinutes} min</span>
                    </Badge>
                  ) : null}

                  {/* Unit status badge */}
                  {lesson.recipeId ? (
                    <Badge variant="success" className="gap-1.5">
                      <IconCheck className="w-3 h-3" />
                      <span>Unidad</span>
                    </Badge>
                  ) : (
                    <Badge variant="default" className="gap-1.5">
                      <span>Sin unidad</span>
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleEditClick(lesson)}
                  className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                  title="Editar lección"
                >
                  <IconEdit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDeleteClick(lesson)}
                  className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  title="Eliminar lección"
                >
                  <IconTrash className="w-5 h-5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add new lesson */}
      <div
        onClick={handleOpenRecipeSelector}
        className="border-2 border-dashed border-sky-300 rounded-2xl p-6 text-center cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition-all group"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center group-hover:bg-sky-200 transition-colors">
            <IconPlus className="w-5 h-5 text-sky-600" />
          </div>
          <div className="text-left">
            <p className="font-bold text-sky-700">Agregar lección</p>
            <p className="text-sm text-slate-500">Selecciona una unidad existente</p>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen ? !!editingLesson : false}
        onClose={handleCloseEditModal}
        title="Editar lección"
        size="md"
        footer={
          <div className="flex gap-3">
            <Button onClick={handleCloseEditModal} variant="secondary" className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} variant="primary" className="flex-1">
              Guardar cambios
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Unit Selection */}
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2">Unidad</label>
            {editRecipeId && selectedRecipe ? (
              <div className="bg-sky-50 border-2 border-sky-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-800 truncate">{selectedRecipe.title}</h3>
                      <Badge variant={selectedRecipe.published ? 'success' : 'warning'}>
                        {selectedRecipe.published ? 'Publicada' : 'Borrador'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {selectedRecipe.expectedDurationMinutes ? (
                        <span className="flex items-center gap-1">
                          <IconClock className="w-3 h-3" />
                          {selectedRecipe.expectedDurationMinutes} min
                        </span>
                      ) : null}
                      <span className="flex items-center gap-1">
                        <IconList className="w-3 h-3" />
                        {selectedRecipe.steps?.length ?? 0} paso
                        {(selectedRecipe.steps?.length ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleViewRecipe}
                      className="p-2 text-sky-600 hover:text-sky-700 hover:bg-white rounded-lg transition-all"
                      title="Ver unidad"
                    >
                      <IconExternalLink className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleClearRecipe}
                      className="p-2 text-rose-500 hover:text-rose-600 hover:bg-white rounded-lg transition-all"
                      title="Quitar unidad"
                    >
                      <IconX className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleOpenRecipeSelector} variant="secondary" className="flex-1">
                  <IconSearch className="w-5 h-5 mr-2" />
                  Seleccionar unidad
                </Button>
              </div>
            )}
            {!editRecipeId ? (
              <p className="text-xs text-slate-400 mt-2">
                Asigna una unidad para habilitar la demo de esta lección
              </p>
            ) : null}
          </div>
        </div>
      </Modal>

      {/* Recipe Selector Modal */}
      {recipeSelectorModal}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen ? !!lessonToDelete : false}
        onClose={handleCloseDeleteModal}
        title="Confirmar eliminación"
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button onClick={handleCloseDeleteModal} variant="secondary" className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleConfirmDelete} variant="danger" className="flex-1">
              Eliminar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-slate-600 font-medium">
            ¿Estás seguro de que deseas eliminar la lección{' '}
            <span className="font-bold text-slate-800">
              "{lessonToDelete?.recipe?.title ?? 'esta lección'}"
            </span>
            ?
          </p>
          <p className="text-slate-500 text-sm">Esta acción no se puede deshacer.</p>
        </div>
      </Modal>
    </div>
  );
}
