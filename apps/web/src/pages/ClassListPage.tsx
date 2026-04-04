import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { IconPlus, IconFilter, IconBook, IconArrowLeft } from '@tabler/icons-react';
import type { ClassStatus } from '@pixel-mentor/shared';

import { useClassStore } from '@/features/class-management/stores/class.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useAudio } from '@/contexts/AudioContext';
import { useAlert, useConfirm } from '@/hooks/useConfirmationDialogs';
import { ClassCard } from '@/features/class-management/components/ClassCard';
import { Button, Card, Spinner, Input } from '@/components/ui';

const STATUS_LABELS: Record<ClassStatus, string> = {
  DRAFT: 'Borrador',
  UNDER_REVIEW: 'En revisión',
  PUBLISHED: 'Publicada',
  ARCHIVED: 'Archivada',
};

const STATUS_COLORS: Record<ClassStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700 border-amber-200',
  PUBLISHED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ARCHIVED: 'bg-rose-100 text-rose-700 border-rose-200',
};

export function ClassListPage() {
  const navigate = useNavigate();
  const { playClick, playSelect } = useAudio();
  const alert = useAlert();
  const confirm = useConfirm();
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
  const { classes, isLoading, error, fetchClasses, createClass, deleteClass } = useClassStore(
    useShallow((state) => ({
      classes: state.classes,
      isLoading: state.isLoading,
      error: state.error,
      fetchClasses: state.fetchClasses,
      createClass: state.createClass,
      deleteClass: state.deleteClass,
    })),
  );

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const [statusFilter, setStatusFilter] = useState<ClassStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (isTeacher) {
      fetchClasses(statusFilter || undefined);
    }
  }, [user, statusFilter, fetchClasses, isTeacher]);

  const filteredClasses = classes.filter((cls) => {
    const matchesStatus = !statusFilter || cls.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      cls.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleCreateClass = async () => {
    playClick();
    setIsCreating(true);
    setCreateError(null);
    try {
      const newClass = await createClass({ title: 'Nueva clase', description: '' });
      navigate(`/classes/${newClass.id}/edit`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear la clase');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditClass = (classId: string) => {
    playSelect();
    navigate(`/classes/${classId}/edit`);
  };

  const handleDeleteClass = async (classId: string, classStatus: ClassStatus) => {
    playClick();

    if (classStatus !== 'DRAFT') {
      await alert({
        title: 'No se puede eliminar',
        message:
          'Solo se pueden eliminar clases en estado borrador. Las clases publicadas deben ser archivadas.',
        variant: 'warning',
      });
      return;
    }

    if (
      !(await confirm({
        title: 'Confirmar eliminación',
        message:
          '¿Estás seguro de que quieres eliminar esta clase? Esta acción no se puede deshacer.',
        variant: 'danger',
      }))
    ) {
      return;
    }

    try {
      await deleteClass(classId);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        await alert({
          title: 'Sesión expirada',
          message: 'Sesión expirada. Inicia sesión de nuevo.',
          variant: 'error',
        });
        navigate('/login', { replace: true });
      } else if (status === 409) {
        await alert({
          title: 'No se puede eliminar',
          message: 'No se puede eliminar una clase que no está en estado borrador.',
          variant: 'warning',
        });
      } else {
        await alert({
          title: 'Error',
          message:
            (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'Error al eliminar la clase',
          variant: 'error',
        });
      }
    }
  };

  const handleFilterChange = (status: ClassStatus | '') => {
    playClick();
    setStatusFilter(status);
  };

  if (!isTeacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <Card variant="mission" className="max-w-md text-center p-8 border-4">
          <IconBook className="w-16 h-16 text-sky-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">Acceso restringido</h2>
          <p className="text-slate-500 font-medium mb-6">
            Solo los tutores pueden acceder a la gestión de clases.
          </p>
          <Link to="/dashboard" className="block outline-none">
            <Button variant="primary" className="w-full">
              <IconArrowLeft className="w-5 h-5 mr-2" /> Volver al mapa
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 font-sans text-slate-800">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b-4 border-sky-200 shadow-[0_4px_0_0_#bae6fd]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-xl hover:bg-sky-50 transition-colors"
              title="Volver al inicio"
            >
              <IconArrowLeft className="w-6 h-6 text-sky-500" />
            </button>

            <div className="flex items-center gap-2.5">
              <IconBook className="w-8 h-8 text-sky-500" stroke={2.5} />
              <h1 className="text-2xl font-black text-sky-700 tracking-tight">Mis Clases</h1>
            </div>
          </div>
          <Button
            onClick={handleCreateClass}
            variant="primary"
            isLoading={isCreating}
            className="shadow-sm"
          >
            <IconPlus className="w-5 h-5 mr-2" />
            Nueva Clase
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {createError ? (
          <div className="mb-6 bg-rose-50 border-4 border-rose-200 rounded-2xl p-4 text-rose-700 font-bold flex items-center justify-between shadow-sm animate-bounce-in">
            <span>Error al crear clase: {createError}</span>
            <button
              onClick={() => setCreateError(null)}
              className="text-rose-400 hover:text-rose-600 bg-rose-100 rounded-full p-1 transition-colors"
            >
              <span className="sr-only">Cerrar</span>×
            </button>
          </div>
        ) : null}

        <div className="bg-white rounded-[2rem] p-6 border-4 border-sky-200 shadow-[0_6px_0_0_#bae6fd] mb-8">
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Buscar clases por título o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-base font-bold"
              />
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 xl:pb-0 custom-scrollbar">
              <IconFilter className="w-5 h-5 text-slate-400 shrink-0 hidden sm:block" />
              <div className="flex gap-2">
                <button
                  onClick={() => handleFilterChange('')}
                  className={`px-4 py-2 shrink-0 rounded-xl text-sm font-bold transition-all border-2 ${
                    !statusFilter
                      ? 'bg-sky-500 text-white border-sky-600 shadow-[0_2px_0_0_#0284c7]'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  Todas
                </button>
                {(Object.keys(STATUS_LABELS) as ClassStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleFilterChange(status)}
                    className={`px-4 py-2 shrink-0 rounded-xl text-sm font-bold transition-all border-2 ${
                      statusFilter === status
                        ? `${STATUS_COLORS[status].replace('bg-', 'bg-').replace('text-', 'text-').replace('border-', 'border-')} shadow-sm border-b-4 translate-y-[-2px]`
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="bg-rose-100 border-4 border-rose-200 rounded-2xl p-4 mb-6 shadow-sm">
            <p className="text-rose-700 font-bold">{error}</p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Spinner size="lg" className="text-sky-500" />
            <p className="text-lg font-black text-sky-600 animate-pulse">Cargando clases...</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <Card
            variant="mission"
            className="text-center p-12 max-w-2xl mx-auto shadow-[0_8px_0_0_#e2e8f0]"
          >
            <div className="w-24 h-24 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-sky-100">
              <IconBook className="w-12 h-12 text-sky-400" stroke={2.5} />
            </div>
            <h2 className="text-2xl font-black text-slate-700 mb-3">
              {searchQuery || statusFilter ? 'No se encontraron clases' : 'No tienes clases aún'}
            </h2>
            <p className="text-slate-500 font-bold mb-8 text-lg">
              {searchQuery || statusFilter
                ? 'Prueba con otros filtros de búsqueda'
                : 'Crea tu primera clase para empezar a compartir tu conocimiento'}
            </p>
            {!searchQuery && !statusFilter ? (
              <Button onClick={handleCreateClass} variant="primary" className="text-lg py-4 px-8">
                <IconPlus className="w-6 h-6 mr-2" />
                Crear mi primera clase
              </Button>
            ) : null}
          </Card>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredClasses.map((cls) => (
              <ClassCard
                key={cls.id}
                classItem={cls}
                onEdit={() => handleEditClass(cls.id)}
                onDelete={() => handleDeleteClass(cls.id, cls.status)}
              />
            ))}
          </div>
        )}

        {classes.length > 0 ? (
          <div className="mt-12 flex items-center justify-center gap-6 text-sm font-bold text-slate-400 bg-white/50 w-max mx-auto px-6 py-2 rounded-full border-2 border-slate-200">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              {classes.length} clase{classes.length !== 1 ? 's' : ''} total
            </span>
            <div className="w-px h-4 bg-slate-300" />
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              {classes.filter((c) => c.status === 'PUBLISHED').length} publicada
              {classes.filter((c) => c.status === 'PUBLISHED').length !== 1 ? 's' : ''}
            </span>
          </div>
        ) : null}
      </main>
    </div>
  );
}
