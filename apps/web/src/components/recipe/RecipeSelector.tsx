import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  IconX,
  IconPlus,
  IconSearch,
  IconClock,
  IconList,
  IconCheck,
  IconRefresh,
} from '@tabler/icons-react';
import { useShallow } from 'zustand/react/shallow';
import type { Recipe } from '@pixel-mentor/shared';

import { useRecipeStore } from '@/stores/recipeStore';
import { useAuthStore } from '@/stores/authStore';
import { useAudio } from '@/contexts/AudioContext';
import { Button, Spinner, Badge } from '@/components/ui';

interface RecipeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (recipeId: string) => void;
}

type FilterTab = 'all' | 'my-recipes' | 'published';

const STATUS_LABELS = {
  draft: 'Borrador',
  published: 'Publicada',
} as const;

const STATUS_VARIANTS = {
  draft: 'warning' as const,
  published: 'success' as const,
};

export function RecipeSelector({ isOpen, onClose, onSelect }: RecipeSelectorProps) {
  const { playClick } = useAudio();
  const navigate = useNavigate();
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
  const portalRef = useRef<HTMLElement | null>(null);

  // Create portal container on mount
  useEffect(() => {
    let container = document.getElementById('recipe-selector-portal');
    if (!container) {
      container = document.createElement('div');
      container.id = 'recipe-selector-portal';
      document.body.appendChild(container);
    }
    portalRef.current = container;
  }, []);

  const { recipes, isLoading, fetchRecipes } = useRecipeStore(
    useShallow((state) => ({
      recipes: state.recipes,
      isLoading: state.isLoading,
      fetchRecipes: state.fetchRecipes,
    })),
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  useEffect(() => {
    if (isOpen && isTeacher) {
      let status: 'my' | 'published' | undefined;
      if (filterTab === 'my-recipes') {
        status = 'my';
      } else if (filterTab === 'published') {
        status = 'published';
      }
      fetchRecipes(status ? { status } : undefined);
    }
  }, [isOpen, filterTab, isTeacher, fetchRecipes]);

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      !searchQuery ||
      recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.description?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesTab = true;
    if (filterTab === 'published') {
      matchesTab = recipe.published;
    } else if (filterTab === 'my-recipes') {
      matchesTab = !recipe.published;
    }

    return matchesSearch && matchesTab;
  });

  const handleSelect = (recipeId: string) => {
    playClick();
    onSelect(recipeId);
    onClose();
  };

  const handleCreateNew = () => {
    playClick();
    onClose();
    navigate('/units/new/edit');
  };

  const handleTabChange = (tab: FilterTab) => {
    playClick();
    setFilterTab(tab);
  };

  if (!isOpen || !portalRef.current) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-4 border-sky-200">
          <h2 className="text-xl font-black text-slate-800">Seleccionar Unidad</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchRecipes()}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
              title="Actualizar recetas"
            >
              <IconRefresh className="w-6 h-6 text-slate-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <IconX className="w-6 h-6 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar recetas..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-base focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => handleTabChange('all')}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                filterTab === 'all'
                  ? 'bg-sky-400 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => handleTabChange('my-recipes')}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                filterTab === 'my-recipes'
                  ? 'bg-sky-400 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Mis Unidades
            </button>
            <button
              onClick={() => handleTabChange('published')}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                filterTab === 'published'
                  ? 'bg-sky-400 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Publicadas
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Spinner size="lg" className="text-sky-500 mb-4" />
              <p className="text-slate-500 font-medium">Cargando recetas...</p>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-8">
              <IconSearch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">
                {searchQuery ? 'No se encontraron recetas' : 'No hay recetas disponibles'}
              </p>
              <Button onClick={handleCreateNew} variant="primary" className="mt-4">
                <IconPlus className="w-5 h-5 mr-2" />
                Crear Nueva Unidad
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecipes.map((recipe) => (
                <RecipeSelectorCard key={recipe.id} recipe={recipe} onSelect={handleSelect} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-4 border-sky-200">
          <Button onClick={handleCreateNew} variant="secondary" className="w-full">
            <IconPlus className="w-5 h-5 mr-2" />
            Crear Nueva Unidad
          </Button>
        </div>
      </div>
    </div>,
    portalRef.current,
  );
}

interface RecipeSelectorCardProps {
  recipe: Recipe;
  onSelect: (recipeId: string) => void;
}

function RecipeSelectorCard({ recipe, onSelect }: RecipeSelectorCardProps) {
  const truncatedDescription = recipe.description
    ? recipe.description.length > 80
      ? `${recipe.description.slice(0, 80)}...`
      : recipe.description
    : '';

  const stepCount = recipe.steps?.length ?? 0;

  return (
    <div
      className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200 hover:border-sky-300 hover:bg-sky-50 cursor-pointer transition-all group"
      onClick={() => onSelect(recipe.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-slate-800 truncate">{recipe.title}</h3>
            <Badge variant={recipe.published ? STATUS_VARIANTS.published : STATUS_VARIANTS.draft}>
              {recipe.published ? <IconCheck className="w-3 h-3 mr-1" /> : null}
              {recipe.published ? STATUS_LABELS.published : STATUS_LABELS.draft}
            </Badge>
          </div>
          {truncatedDescription ? (
            <p className="text-sm text-slate-500 truncate mb-2">{truncatedDescription}</p>
          ) : null}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {recipe.expectedDurationMinutes ? (
              <span className="flex items-center gap-1">
                <IconClock className="w-3 h-3" />
                {recipe.expectedDurationMinutes} min
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <IconList className="w-3 h-3" />
              {stepCount} paso{stepCount !== 1 ? 's' : ''}
            </span>
            <span className="font-mono">v{recipe.version}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
