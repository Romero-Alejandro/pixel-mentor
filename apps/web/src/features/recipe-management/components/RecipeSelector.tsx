import { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { IconX, IconPlus, IconSearch, IconClock, IconList, IconRefresh } from '@tabler/icons-react';
import { useShallow } from 'zustand/react/shallow';
import type { Recipe } from '@pixel-mentor/shared';

import { useRecipeStore } from '@/features/recipe-management/stores/recipe.store';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAudio } from '@/contexts/AudioContext';
import { Button, Spinner, Badge } from '@/components/ui';

interface RecipeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (recipeId: string) => void;
}

type FilterTab = 'all' | 'my-recipes' | 'published';

const FILTER_MAPPING: Record<FilterTab, 'my' | 'published' | undefined> = {
  all: undefined,
  'my-recipes': 'my',
  published: 'published',
};

const renderSafe = (value: unknown): string => {
  if (value === null || value === undefined || typeof value === 'object') return '';
  return String(value);
};

export function RecipeSelector({ isOpen, onClose, onSelect }: RecipeSelectorProps) {
  const { playClick } = useAudio();
  const navigate = useNavigate();
  const { user } = useAuth();
  const portalRef = useRef<HTMLElement | null>(null);

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
      const status = FILTER_MAPPING[filterTab];
      fetchRecipes(status ? { status } : undefined);
    }
  }, [isOpen, filterTab, isTeacher, fetchRecipes]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const normalizedTitle = recipe.title?.toLowerCase() || '';
      const normalizedDesc = recipe.description?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();

      const matchesSearch =
        !searchQuery || normalizedTitle.includes(query) || normalizedDesc.includes(query);

      let matchesTab = true;
      if (filterTab === 'published') matchesTab = recipe.published;
      else if (filterTab === 'my-recipes') matchesTab = !recipe.published;

      return matchesSearch && matchesTab;
    });
  }, [recipes, searchQuery, filterTab]);

  const handleSelect = useCallback(
    (recipeId: string) => {
      playClick();
      onSelect(recipeId);
      onClose();
    },
    [playClick, onSelect, onClose],
  );

  const handleCreateNew = useCallback(() => {
    playClick();
    onClose();
    navigate('/units/new/edit');
  }, [playClick, onClose, navigate]);

  const handleTabChange = (tab: FilterTab) => {
    playClick();
    setFilterTab(tab);
  };

  if (!isOpen || !portalRef.current) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-sky-900/40 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-gummy border-8 border-sky-100 max-h-[85vh] overflow-hidden flex flex-col">
        <header className="flex items-center justify-between p-6 bg-sky-50/50 border-b-4 border-sky-100">
          <div>
            <h2 className="text-2xl font-black text-sky-800 tracking-tight">Elegir Unidad</h2>
            <p className="text-xs font-bold text-sky-400 uppercase tracking-widest">
              Aventura de aprendizaje
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchRecipes()}
              className="p-3 rounded-2xl bg-white border-2 border-sky-200 hover:bg-sky-100 transition-all active:scale-95"
            >
              <IconRefresh className="w-6 h-6 text-sky-500" />
            </button>
            <button
              onClick={onClose}
              className="p-3 rounded-2xl bg-white border-2 border-rose-200 hover:bg-rose-100 transition-all active:scale-95"
            >
              <IconX className="w-6 h-6 text-rose-500" />
            </button>
          </div>
        </header>

        <div className="p-6 space-y-4">
          <div className="relative">
            <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-sky-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="¿Qué quieres enseñar hoy?"
              className="w-full pl-12 pr-4 py-4 bg-sky-50/50 border-4 border-sky-100 rounded-[1.5rem] text-lg font-bold text-sky-900 placeholder:text-sky-200 focus:border-sky-300 outline-none transition-all"
            />
          </div>

          <nav className="flex gap-2">
            {(['all', 'my-recipes', 'published'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 ${
                  filterTab === tab
                    ? 'bg-sky-500 text-white shadow-gummy-sm'
                    : 'bg-white text-sky-400 border-2 border-sky-100 hover:bg-sky-50'
                }`}
              >
                {tab === 'all' ? '✨ Todas' : null}
                {tab === 'my-recipes' ? '📝 Borradores' : null}
                {tab === 'published' ? '🎯 Listas' : null}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner size="lg" className="text-sky-400" />
              <p className="mt-4 font-black text-sky-300">Buscando tesoros...</p>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-4 border-dashed border-slate-200">
              <p className="font-bold text-slate-400 italic">
                ¡Vaya! No encontramos nada por aquí.
              </p>
            </div>
          ) : (
            filteredRecipes.map((recipe) => (
              <RecipeSelectorCard key={recipe.id} recipe={recipe} onSelect={handleSelect} />
            ))
          )}
        </div>

        <footer className="p-6 bg-slate-50 border-t-4 border-slate-100">
          <Button
            onClick={handleCreateNew}
            variant="primary"
            className="w-full py-6 rounded-2xl text-xl shadow-gummy"
          >
            <IconPlus className="w-6 h-6 mr-2" stroke={3} />
            Crear Nueva Unidad
          </Button>
        </footer>
      </div>
    </div>,
    portalRef.current,
  );
}

const RecipeSelectorCard = memo(
  ({ recipe, onSelect }: { recipe: Recipe; onSelect: (id: string) => void }) => {
    const stepCount = recipe.steps?.length ?? 0;

    return (
      <div
        className="p-5 bg-white rounded-[1.5rem] border-4 border-sky-50 hover:border-sky-200 hover:bg-sky-50/30 cursor-pointer transition-all active:scale-[0.98] group"
        onClick={() => onSelect(recipe.id)}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-black text-sky-900 truncate">{renderSafe(recipe.title)}</h3>
          <Badge variant={recipe.published ? 'success' : 'warning'} className="rounded-full px-3">
            {recipe.published ? 'Publicada' : 'Borrador'}
          </Badge>
        </div>

        <p className="text-sm font-medium text-slate-400 line-clamp-1 mb-3">
          {renderSafe(recipe.description) || '¡Dale una descripción a esta unidad!'}
        </p>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-100/50 rounded-full text-[10px] font-black text-sky-600 uppercase">
            <IconClock className="w-3 h-3" stroke={3} />
            {renderSafe(recipe.expectedDurationMinutes)} MIN
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-100/50 rounded-full text-[10px] font-black text-purple-600 uppercase">
            <IconList className="w-3 h-3" stroke={3} />
            {stepCount} PASOS
          </div>
          <div className="ml-auto text-[10px] font-black text-slate-300 font-mono">
            V{renderSafe(recipe.version)}
          </div>
        </div>
      </div>
    );
  },
);

RecipeSelectorCard.displayName = 'RecipeSelectorCard';
