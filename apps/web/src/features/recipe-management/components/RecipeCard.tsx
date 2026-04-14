import React, { memo, useCallback } from 'react';
import {
  IconClock,
  IconTrash,
  IconCheck,
  IconDots,
  IconStar,
  IconList,
  IconEdit,
} from '@tabler/icons-react';
import type { Recipe } from '@pixel-mentor/shared';
import { Card, Badge, Button } from '@/components/ui';

interface RecipeCardProps {
  recipe: Recipe;
  onEdit: (recipeId: string) => void;
  onDelete: (recipeId: string) => void;
  onPublish?: (recipeId: string) => void;
}

const STEP_COLORS = [
  'bg-sky-200',
  'bg-purple-200',
  'bg-amber-200',
  'bg-emerald-200',
  'bg-rose-200',
];

const renderSafe = (value: any): string => {
  if (value === null || value === undefined || typeof value === 'object') return '';
  return String(value);
};

export const RecipeCard = memo(({ recipe, onEdit, onDelete, onPublish }: RecipeCardProps) => {
  const isDraft = !recipe.published;
  const stepCount = recipe.steps?.length ?? 0;

  const handleAction = useCallback(
    (e: React.MouseEvent, action: (id: string) => void) => {
      e.preventDefault();
      e.stopPropagation();
      action(recipe.id);
    },
    [recipe.id],
  );

  return (
    <Card
      variant="mission"
      className="group relative flex flex-col h-full cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.02] border-4 border-sky-100 hover:border-sky-300 shadow-none hover:shadow-gummy hover:shadow-sky-100"
      onClick={() => onEdit(recipe.id)}
    >
      <div className={`h-3 w-full ${recipe.published ? 'bg-emerald-400' : 'bg-amber-400'}`} />

      <div className="p-6 flex-1 flex flex-col">
        <header className="flex items-start justify-between gap-2 mb-4">
          <h3 className="text-xl font-black text-sky-900 leading-tight flex-1">
            {renderSafe(recipe.title) || 'Sin título'}
          </h3>
          <Badge
            variant={recipe.published ? 'success' : 'warning'}
            className="rounded-full px-3 py-1 border-2 border-white shadow-sm"
          >
            <span className="flex items-center gap-1 uppercase text-[10px] font-black tracking-tighter">
              {recipe.published ? (
                <IconCheck size={12} stroke={4} />
              ) : (
                <IconDots size={12} stroke={4} />
              )}
              {recipe.published ? 'Lista' : 'Borrador'}
            </span>
          </Badge>
        </header>

        <p className="text-slate-400 text-sm font-bold line-clamp-3 mb-6 flex-1 italic">
          {renderSafe(recipe.description) || 'Sin descripción disponible'}
        </p>

        {stepCount > 0 ? (
          <div className="mb-6 flex gap-2 flex-wrap">
            {recipe.steps?.slice(0, 4).map((step, idx) => (
              <div
                key={step.id}
                className={`w-9 h-9 rounded-full ${STEP_COLORS[idx % STEP_COLORS.length]} flex items-center justify-center text-sm font-black text-white border-4 border-white shadow-sm`}
              >
                {idx + 1}
              </div>
            ))}
            {stepCount > 4 ? (
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400 border-4 border-white shadow-sm">
                +{stepCount - 4}
              </div>
            ) : null}
          </div>
        ) : null}

        <footer className="flex items-center justify-between pt-4 border-t-2 border-sky-50 mt-auto">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sky-400 font-black text-[11px] uppercase tracking-wider">
              <IconClock size={16} stroke={3} />
              {renderSafe(recipe.expectedDurationMinutes)} min
            </div>
            <div className="flex items-center gap-1.5 text-purple-400 font-black text-[11px] uppercase tracking-wider">
              <IconList size={16} stroke={3} />
              {stepCount} pasos
            </div>
          </div>
          {recipe.version ? (
            <div className="flex items-center gap-1 text-amber-400 font-black text-[11px] uppercase tracking-wider">
              <IconStar size={14} stroke={3} />v{renderSafe(recipe.version)}
            </div>
          ) : null}
        </footer>
      </div>

      <div className="bg-sky-50/50 px-4 py-4 flex gap-2 border-t-2 border-sky-50">
        {isDraft && onPublish ? (
          <Button
            onClick={(e) => handleAction(e, onPublish)}
            variant="success"
            size="sm"
            className="flex-1 rounded-xl shadow-none font-black text-xs uppercase"
          >
            Publicar
          </Button>
        ) : null}
        <Button
          onClick={(e) => handleAction(e, onEdit)}
          variant="secondary"
          size="sm"
          className="flex-1 rounded-xl shadow-none font-black text-xs uppercase"
        >
          <IconEdit size={16} className="mr-1" /> Editar
        </Button>
        <Button
          onClick={(e) => handleAction(e, onDelete)}
          variant="danger"
          size="sm"
          className="px-4 rounded-xl shadow-none"
        >
          <IconTrash size={18} stroke={2.5} />
        </Button>
      </div>
    </Card>
  );
});

RecipeCard.displayName = 'RecipeCard';
