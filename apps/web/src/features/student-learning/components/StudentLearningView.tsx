import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBooks, IconAlertTriangle, IconRefresh, IconSchool } from '@tabler/icons-react';
import { useStudentLearningStore } from '../stores/student-learning.store';
import { GroupLearningCard } from '../components/LearningPathCard';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

export function StudentLearningView() {
  const navigate = useNavigate();
  const { accessibleContent, loading, error, fetchAccessibleContent } = useStudentLearningStore();

  useEffect(() => {
    fetchAccessibleContent();
  }, [fetchAccessibleContent]);

  const groupedContent = useMemo(() => {
    const grouped = accessibleContent.reduce(
      (acc, item) => {
        if (!acc[item.groupId]) {
          acc[item.groupId] = { id: item.groupId, name: item.groupName, classes: [] };
        }
        acc[item.groupId].classes.push(item);
        return acc;
      },
      {} as Record<string, { id: string; name: string; classes: typeof accessibleContent }>,
    );

    return Object.values(grouped);
  }, [accessibleContent]);

  if (loading && accessibleContent.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Spinner size="xl" className="text-sky-500" />
        <p className="text-sky-700 font-black tracking-widest uppercase text-sm animate-pulse">
          Preparando tu aventura...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-rose-50 border-4 border-rose-200 rounded-[2.5rem] text-center gap-5 shadow-sm">
        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center">
          <IconAlertTriangle className="w-10 h-10 text-rose-500" stroke={2.5} />
        </div>
        <div>
          <h3 className="text-2xl font-black text-rose-700 mb-2 tracking-tight">
            ¡Oh no! Algo salió mal
          </h3>
          <p className="text-rose-600 font-bold max-w-sm">{error}</p>
        </div>
        <Button
          onClick={fetchAccessibleContent}
          className="mt-2 bg-rose-500 hover:bg-rose-400 text-white border-4 border-rose-600 shadow-[0_4px_0_0_#be123c] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none transition-all px-6 py-3 rounded-2xl font-black"
        >
          <IconRefresh className="w-5 h-5 mr-2" stroke={3} /> Intentar de nuevo
        </Button>
      </div>
    );
  }

  if (accessibleContent.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-10 bg-slate-50 rounded-[2.5rem] border-4 border-slate-200 shadow-sm">
        <div className="w-24 h-24 bg-white border-4 border-slate-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <IconBooks className="w-12 h-12 text-slate-300" stroke={2} />
        </div>
        <h3 className="text-3xl font-black text-slate-700 mb-3 tracking-tight">
          Tu mochila está vacía
        </h3>
        <p className="text-slate-500 font-bold max-w-md mb-8 text-lg leading-relaxed">
          Todavía no tienes misiones asignadas. Contacta a tu profesor para que te añada a un grupo
          y puedas comenzar a aprender.
        </p>
        <Button
          onClick={fetchAccessibleContent}
          className="bg-white text-slate-500 border-4 border-slate-200 hover:bg-slate-100 hover:text-slate-700 shadow-[0_4px_0_0_#e2e8f0] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none transition-all px-8 py-3 rounded-2xl font-black"
        >
          <IconRefresh className="w-5 h-5 mr-2" stroke={3} /> Actualizar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-[2.5rem] border-4 border-sky-100 shadow-[0_8px_0_0_#e0f2fe]">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-sky-100 rounded-[1.5rem] border-4 border-sky-200">
            <IconSchool className="w-8 h-8 text-sky-500" stroke={2.5} />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              Mi Camino de Aprendizaje
            </h2>
            <div className="inline-flex items-center gap-2 mt-2 bg-sky-50 px-3 py-1 rounded-full border-2 border-sky-100">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <p className="text-xs font-black text-sky-600 uppercase tracking-wider">
                {accessibleContent.length} misión{accessibleContent.length !== 1 ? 'es' : ''}{' '}
                disponible{accessibleContent.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={fetchAccessibleContent}
          className="group flex items-center justify-center p-4 bg-slate-50 hover:bg-sky-50 border-4 border-slate-200 hover:border-sky-200 rounded-[1.5rem] text-slate-400 hover:text-sky-500 transition-all outline-none focus-visible:ring-4 focus-visible:ring-sky-200 shrink-0"
          aria-label="Actualizar contenido"
        >
          <IconRefresh
            className="w-6 h-6 transition-transform group-active:rotate-180 duration-500"
            stroke={3}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {groupedContent.map((group) => (
          <GroupLearningCard
            key={group.id}
            groupName={group.name}
            classes={group.classes}
            onClassClick={(classId) => navigate(`/classes/${classId}/lessons`)}
          />
        ))}
      </div>
    </div>
  );
}
