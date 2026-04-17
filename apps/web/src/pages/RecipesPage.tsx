import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  IconPlus,
  IconSearch,
  IconArrowLeft,
  IconStar,
  IconEdit,
  IconCheck,
  IconAlertCircle,
  IconX,
} from '@tabler/icons-react';

import { useRecipeStore } from '@/features/recipe-management/stores/recipe.store';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirmationDialogs';
import { RecipeCard } from '@/features/recipe-management/components/RecipeCard';
import { Button, Card, Spinner, Input } from '@/components/ui';

type FilterStatus = 'all' | 'my-drafts' | 'my-published';

interface FilterConfig {
  /** Whether to show only the current user's recipes */
  isMy: boolean;
  /** Whether to show only published recipes */
  publishedOnly: boolean;
}

const FILTER_CONFIG: Record<FilterStatus, FilterConfig> = {
  'my-drafts': { isMy: true, publishedOnly: false },
  'my-published': { isMy: true, publishedOnly: true },
  all: { isMy: false, publishedOnly: true },
};

export function RecipesPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useAuth();

  const { recipes, isLoading, error, fetchRecipes, deleteRecipe, updateRecipe, clearError } =
    useRecipeStore(
      useShallow((state) => ({
        recipes: state.recipes,
        isLoading: state.isLoading,
        error: state.error,
        fetchRecipes: state.fetchRecipes,
        deleteRecipe: state.deleteRecipe,
        updateRecipe: state.updateRecipe,
        clearError: state.clearError,
      })),
    );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('my-drafts');

  const isAuthorizedTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  useEffect(() => {
    if (isAuthorizedTeacher) {
      const config = FILTER_CONFIG[filterStatus];
      fetchRecipes({ isMy: config.isMy, publishedOnly: config.publishedOnly });
    }
  }, [filterStatus, isAuthorizedTeacher, fetchRecipes]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const normalizedSearch = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        recipe.title.toLowerCase().includes(normalizedSearch) ||
        recipe.description?.toLowerCase().includes(normalizedSearch);

      let matchesStatus = true;
      if (filterStatus === 'my-drafts') matchesStatus = !recipe.published;
      else if (filterStatus === 'my-published') matchesStatus = recipe.published;
      else if (filterStatus === 'all') matchesStatus = recipe.published;

      return matchesSearch && matchesStatus;
    });
  }, [recipes, searchQuery, filterStatus]);

  const handleCreateRecipe = useCallback(() => {
    navigate('/units/new/edit');
  }, [navigate]);

  const handleEditRecipe = useCallback(
    (recipeId: string) => {
      navigate(`/units/${recipeId}/edit`);
    },
    [navigate],
  );

  const handleDeleteRecipe = useCallback(
    async (recipeId: string) => {
      const recipe = recipes.find((r) => r.id === recipeId);
      const isConfirmed = await confirm({
        title: 'Eliminar unidad',
        message: `¿Seguro que quieres eliminar "${recipe?.title}"?`,
        variant: 'danger',
        confirmText: 'Eliminar',
      });

      if (isConfirmed) await deleteRecipe(recipeId);
    },
    [recipes, confirm, deleteRecipe],
  );

  const handlePublishRecipe = useCallback(
    async (recipeId: string) => {
      const recipe = recipes.find((r) => r.id === recipeId);
      const isConfirmed = await confirm({
        title: 'Publicar unidad',
        message: `¿Listo para publicar "${recipe?.title}"?`,
        variant: 'info',
        confirmText: 'Publicar',
      });

      if (isConfirmed) await updateRecipe(recipeId, { published: true });
    },
    [recipes, confirm, updateRecipe],
  );

  if (!isAuthorizedTeacher) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center p-6">
        <Card variant="mission" className="max-w-md text-center p-10 border-slate-200 shadow-none">
          <IconAlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-700 mb-2">Acceso restringido</h2>
          <p className="text-slate-400 font-medium">Solo tutores autorizados.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50/50">
      <header className="bg-white sticky top-0 z-50 border-b-4 border-sky-100 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-3 rounded-2xl bg-sky-50 text-sky-500 hover:bg-sky-100 transition-all"
            >
              <IconArrowLeft size={24} stroke={3} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-sky-800 tracking-tight">Mis Unidades</h1>
              <p className="text-xs font-bold text-sky-300 uppercase tracking-widest">
                Gestión de materiales
              </p>
            </div>
          </div>
          <Button
            onClick={handleCreateRecipe}
            variant="primary"
            size="lg"
            className="rounded-2xl shadow-gummy shadow-sky-200"
          >
            <IconPlus size={20} className="mr-2" stroke={3} />
            Nueva Unidad
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {error ? (
          <div className="mb-8 bg-rose-50 border-4 border-rose-100 rounded-[1.5rem] p-5 text-rose-600 font-bold flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconAlertCircle size={24} />
              <span>{String(error)}</span>
            </div>
            <button
              onClick={clearError}
              className="p-2 hover:bg-rose-100 rounded-xl transition-colors"
            >
              <IconX size={20} />
            </button>
          </div>
        ) : null}

        <section className="bg-white rounded-[2.5rem] p-8 border-4 border-sky-100 shadow-gummy shadow-sky-100 mb-10">
          <div className="flex flex-col lg:flex-row gap-6 items-end">
            <div className="flex-1 w-full space-y-2">
              <label className="text-sm font-black text-sky-800 uppercase tracking-wider ml-1">
                Buscador
              </label>
              <div className="relative">
                <IconSearch
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-200"
                  size={24}
                />
                <Input
                  type="text"
                  placeholder="Escribe el nombre de la unidad..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 bg-sky-50/50 border-4 border-sky-50 focus:border-sky-200 rounded-2xl text-lg font-bold"
                />
              </div>
            </div>

            <div className="w-full lg:w-auto space-y-2">
              <label className="text-sm font-black text-sky-800 uppercase tracking-wider ml-1">
                Estado
              </label>
              <div className="flex gap-2 p-2 bg-sky-50/50 rounded-[1.5rem] border-2 border-sky-50">
                {(['all', 'my-drafts', 'my-published'] as FilterStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-6 py-3 rounded-xl font-black text-sm transition-all ${
                      filterStatus === status
                        ? 'bg-sky-500 text-white shadow-md'
                        : 'text-sky-300 hover:bg-sky-100'
                    }`}
                  >
                    {status === 'all' ? <IconStar size={18} /> : null}
                    {status === 'my-drafts' ? <IconEdit size={18} /> : null}
                    {status === 'my-published' ? <IconCheck size={18} /> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {isLoading && filteredRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Spinner size="lg" className="text-sky-400" />
            <p className="text-sky-300 font-black mt-4 uppercase tracking-widest">Cargando...</p>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <Card className="text-center py-20 border-4 border-dashed border-sky-100 bg-white/50 shadow-none">
            <IconSearch className="w-20 h-20 text-sky-100 mx-auto mb-4" />
            <h3 className="text-2xl font-black text-sky-800 mb-4">No hay unidades aquí</h3>
            <Button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
              }}
              variant="secondary"
            >
              Limpiar filtros
            </Button>
          </Card>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onEdit={handleEditRecipe}
                onDelete={handleDeleteRecipe}
                onPublish={handlePublishRecipe}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
