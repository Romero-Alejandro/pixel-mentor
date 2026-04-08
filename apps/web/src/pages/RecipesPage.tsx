import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { IconPlus, IconFilter, IconSearch, IconBook, IconArrowLeft } from '@tabler/icons-react';

import { useRecipeStore } from '@/features/recipe-management/stores/recipe.store';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAudio } from '@/contexts/AudioContext';
import { useConfirm } from '@/hooks/useConfirmationDialogs';
import { RecipeCard } from '@/features/recipe-management/components/RecipeCard';
import { Button, Card, Spinner, Input } from '@/components/ui';

type FilterStatus = 'all' | 'my-drafts' | 'my-published';

export function RecipesPage() {
  const navigate = useNavigate();
  const { playClick } = useAudio();
  const confirm = useConfirm();
  const { user } = useAuth();

  const { recipes, isLoading, error, fetchRecipes, deleteRecipe, clearError } = useRecipeStore(
    useShallow((state) => ({
      recipes: state.recipes,
      isLoading: state.isLoading,
      error: state.error,
      fetchRecipes: state.fetchRecipes,
      deleteRecipe: state.deleteRecipe,
      clearError: state.clearError,
    })),
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  useEffect(() => {
    if (isTeacher) {
      let status: 'my' | 'published' | undefined;
      if (filterStatus === 'my-drafts') {
        status = 'my'; // Will show all my recipes (draft + published), filtered client-side
      } else if (filterStatus === 'my-published') {
        status = 'my';
      } else if (filterStatus === 'all') {
        status = 'published';
      }
      fetchRecipes(status ? { status } : undefined);
    }
  }, [filterStatus, isTeacher, fetchRecipes]);

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      !searchQuery ||
      recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.description?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStatus = true;
    if (filterStatus === 'my-drafts') {
      matchesStatus = !recipe.published;
    } else if (filterStatus === 'my-published') {
      matchesStatus = recipe.published;
    } else if (filterStatus === 'all') {
      matchesStatus = recipe.published;
    }

    return matchesSearch && matchesStatus;
  });

  const handleCreateRecipe = () => {
    playClick();
    navigate('/units/new/edit');
  };

  const handleEditRecipe = (recipeId: string) => {
    playClick();
    navigate(`/units/${recipeId}/edit`);
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    playClick();
    const recipe = recipes.find((r) => r.id === recipeId);
    if (
      await confirm({
        title: 'Confirmar eliminación',
        message: `¿Estás seguro de que quieres eliminar la unidad "${recipe?.title}"?`,
        variant: 'danger',
      })
    ) {
      try {
        await deleteRecipe(recipeId);
      } catch {
        // Error handled in store
      }
    }
  };

  const handleRecipeClick = (recipeId: string) => {
    navigate(`/units/${recipeId}/edit`);
  };

  const handleFilterChange = (status: FilterStatus) => {
    playClick();
    setFilterStatus(status);
  };

  if (!isTeacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card variant="mission" className="max-w-md text-center p-8">
          <IconBook className="w-16 h-16 text-sky-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">Acceso restringido</h2>
          <p className="text-slate-500 font-medium">
            Solo los tutores pueden acceder a la gestión de unidads.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b-4 border-sky-200 shadow-gummy shadow-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-xl hover:bg-sky-50 transition-colors"
              title="Volver al inicio"
            >
              <IconArrowLeft className="w-6 h-6 text-sky-500" />
            </button>
            <IconBook className="w-8 h-8 text-sky-500" stroke={2.5} />
            <h1 className="text-2xl font-black text-sky-700 tracking-tight">Mis Unidades</h1>
          </div>
          <Button onClick={handleCreateRecipe} variant="primary">
            <IconPlus className="w-5 h-5 mr-2" />
            Nueva Unidad
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error display */}
        {error ? (
          <div className="mb-6 bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 text-rose-700 font-bold flex items-center justify-between">
            <span>Error: {error}</span>
            <button onClick={clearError} className="text-rose-400 hover:text-rose-600 text-xl">
              ×
            </button>
          </div>
        ) : null}

        {/* Filters */}
        <div className="bg-white rounded-[2rem] p-6 border-4 border-sky-200 shadow-gummy shadow-sky-200 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Buscar unidads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <IconFilter className="w-5 h-5 text-slate-400" />
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleFilterChange('all')}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                    filterStatus === 'all'
                      ? 'bg-sky-400 text-white shadow-gummy'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas publicadas
                </button>
                <button
                  onClick={() => handleFilterChange('my-drafts')}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                    filterStatus === 'my-drafts'
                      ? 'bg-amber-400 text-white shadow-gummy'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Mis borradores
                </button>
                <button
                  onClick={() => handleFilterChange('my-published')}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                    filterStatus === 'my-published'
                      ? 'bg-emerald-400 text-white shadow-gummy'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Mis publicadas
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner size="lg" className="text-sky-500 mb-4" />
            <p className="text-sky-600 font-bold">Cargando unidads...</p>
          </div>
        ) : /* Empty state */ filteredRecipes.length === 0 ? (
          <div className="text-center py-16">
            <IconSearch className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-600 mb-2">
              {searchQuery || filterStatus !== 'all'
                ? 'No se encontraron unidads'
                : 'No hay unidads aún'}
            </h3>
            <p className="text-slate-500 font-medium mb-6">
              {searchQuery || filterStatus !== 'all'
                ? 'Intenta con otros filtros de búsqueda'
                : 'Crea tu primera unidad para comenzar'}
            </p>
            {!searchQuery && filterStatus === 'all' ? (
              <Button onClick={handleCreateRecipe} variant="primary">
                <IconPlus className="w-5 h-5 mr-2" />
                Crear Primera Unidad
              </Button>
            ) : null}
          </div>
        ) : (
          /* Recipe grid */ <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onEdit={handleEditRecipe}
                onDelete={handleDeleteRecipe}
                onClick={handleRecipeClick}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
