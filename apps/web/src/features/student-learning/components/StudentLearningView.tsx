import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentLearningStore } from '../stores/student-learning.store';
import { GroupLearningCard } from '../components/LearningPathCard';
import { Spinner } from '@/components/ui/Spinner';

export function StudentLearningView() {
  const navigate = useNavigate();
  const { accessibleContent, loading, error, fetchAccessibleContent } = useStudentLearningStore();

  useEffect(() => {
    fetchAccessibleContent();
  }, [fetchAccessibleContent]);

  if (loading && accessibleContent.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" className="text-sky-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border-4 border-rose-100 rounded-2xl text-rose-600">
        Error al cargar tu aprendizaje: {error}
      </div>
    );
  }

  if (accessibleContent.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-50 rounded-3xl border-4 border-slate-100">
        <p className="text-slate-500 font-medium">No tienes contenido disponible aún</p>
        <p className="text-sm text-slate-400 mt-2">
          Contacta a tu profesor para que te añada a un grupo
        </p>
      </div>
    );
  }

  const groupedByGroup = accessibleContent.reduce(
    (acc, item) => {
      if (!acc[item.groupId]) {
        acc[item.groupId] = { name: item.groupName, classes: [] };
      }
      acc[item.groupId].classes.push(item);
      return acc;
    },
    {} as Record<string, { name: string; classes: typeof accessibleContent }>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800">Mi Camino de Aprendizaje</h2>
        <span className="text-sm text-slate-500">
          {accessibleContent.length} clase{accessibleContent.length !== 1 ? 's' : ''} disponible
          {accessibleContent.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedByGroup).map(([groupId, { name, classes }]) => (
          <GroupLearningCard
            key={groupId}
            groupName={name}
            classes={classes}
            onClassClick={(classId) => navigate(`/classes/${classId}/lessons`)}
          />
        ))}
      </div>
    </div>
  );
}
