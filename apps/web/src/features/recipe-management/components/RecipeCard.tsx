import { IconClock, IconList, IconEdit, IconTrash, IconCheck } from '@tabler/icons-react';
import type { Recipe } from '@pixel-mentor/shared';

import { Card, Badge, Button } from '@/components/ui';
import { useAudio } from '@/contexts/AudioContext';

interface RecipeCardProps {
  recipe: Recipe;
  onEdit: (recipeId: string) => void;
  onDelete: (recipeId: string) => void;
  onClick?: (recipeId: string) => void;
}

const STATUS_LABELS = {
  draft: 'Borrador',
  published: 'Publicada',
} as const;

const STATUS_VARIANTS = {
  draft: 'warning' as const,
  published: 'success' as const,
};

export function RecipeCard({ recipe, onEdit, onDelete, onClick }: RecipeCardProps) {
  const { playClick } = useAudio();

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    playClick();
    onEdit(recipe.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    playClick();
    onDelete(recipe.id);
  };

  const handleClick = () => {
    playClick();
    onClick?.(recipe.id);
  };

  const truncatedDescription = recipe.description
    ? recipe.description.length > 100
      ? `${recipe.description.slice(0, 100)}...`
      : recipe.description
    : '';

  const stepCount = recipe.steps?.length ?? 0;

  return (
    <Card
      variant="mission"
      className="cursor-pointer group hover:border-sky-300 hover:shadow-gummy hover:shadow-sky-200 transition-all duration-200"
      onClick={handleClick}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-800 truncate flex-1 mr-2">{recipe.title}</h3>
          <Badge variant={recipe.published ? STATUS_VARIANTS.published : STATUS_VARIANTS.draft}>
            {recipe.published ? <IconCheck className="w-3 h-3 mr-1" /> : null}
            {recipe.published ? STATUS_LABELS.published : STATUS_LABELS.draft}
          </Badge>
        </div>

        {/* Description */}
        {truncatedDescription ? (
          <p className="text-slate-500 text-sm mb-4 line-clamp-2">{truncatedDescription}</p>
        ) : (
          <p className="text-slate-400 text-sm italic mb-4">Sin descripción</p>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-4 mb-4 mt-auto">
          {recipe.expectedDurationMinutes ? (
            <div className="flex items-center gap-1.5 text-slate-500 text-sm">
              <IconClock className="w-4 h-4" />
              <span>
                {typeof recipe.expectedDurationMinutes === 'object'
                  ? ''
                  : recipe.expectedDurationMinutes}{' '}
                min
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
            <IconList className="w-4 h-4" />
            <span>
              {stepCount} paso{stepCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
            <span className="font-mono">
              v{typeof recipe.version === 'object' ? '' : recipe.version}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          <Button onClick={handleEdit} variant="secondary" size="sm" className="flex-1">
            <IconEdit className="w-4 h-4 mr-1.5" />
            Editar
          </Button>
          <Button onClick={handleDelete} variant="danger" size="sm" className="px-3">
            <IconTrash className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
