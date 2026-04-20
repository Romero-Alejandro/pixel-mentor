import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { IconBook, IconClock, IconUser } from '@tabler/icons-react';

import { api } from '@/services/api';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useLessonStore } from '@/features/lesson/stores/lesson.store';

export interface ClassLesson {
  id: string;
  title: string;
  recipeId: string;
  order: number;
}

export interface ClassData {
  id: string;
  title: string;
  lessons: ClassLesson[];
}

export function ClassLessonsPage() {
  const { classId } = useParams<{ classId: string }>();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadClassData = async () => {
      if (!classId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await api.getClass(classId);
        const lessons: ClassLesson[] = response.lessons.map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title ?? lesson.recipe?.title ?? 'Untitled Lesson',
          recipeId: lesson.recipeId,
          order: lesson.order,
        }));

        setClassData({
          id: response.id,
          title: response.title,
          lessons: lessons.sort((a, b) => a.order - b.order),
        });
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'Failed to load class data');
      } finally {
        setLoading(false);
      }
    };

    loadClassData();
  }, [classId]);

  const handleLessonClick = async (lessonId: string) => {
    navigate(`/lesson/${lessonId}`);
  };

  if (loading && !classData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f9ff]">
        <div className="text-center">
          <Spinner size="lg" className="text-sky-500" />
          <p className="mt-4 text-sky-800 font-bold">Cargando clase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border-4 border-rose-100 rounded-2xl text-rose-600">
        Error al cargar la clase: {error}
        <Button variant="secondary" onClick={() => navigate('/my-learning')} className="mt-4">
          Volver al aprendizaje
        </Button>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="text-center py-16 bg-slate-50 rounded-3xl border-4 border-slate-100">
        <p className="text-slate-500 font-medium">Clase no encontrada</p>
        <Button variant="secondary" onClick={() => navigate('/my-learning')} className="mt-4">
          Volver al aprendizaje
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f9ff] flex flex-col">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <IconBook className="text-sky-500" size={24} />
          <h1 className="text-2xl font-black">{classData.title}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <IconUser className="text-slate-400" size={20} />
          <span>Acceso mediante grupo de aprendizaje</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {classData.lessons.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Esta clase no tiene lecciones disponibles aún.</p>
            <p className="text-sm text-slate-400 mt-2">
              Contacta a tu profesor para que añada lecciones a esta clase.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {classData.lessons.map((lesson) => (
              <Card
                key={lesson.id}
                className="transition-all duration-200 hover:shadow-md cursor-pointer"
                onClick={() => handleLessonClick(lesson.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <div
                      className={`w-8 h-8 flex items-center justify-center rounded-lg bg-sky-100 text-sky-600 font-bold`}
                    >
                      {lesson.order + 1}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="font-bold text-slate-800">{lesson.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <IconClock className="text-slate-400" size={16} />
                      <span>Lección</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLessonClick(lesson.id);
                    }}
                  >
                    Iniciar lección
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between px-6">
          <Button variant="outline" onClick={() => navigate('/my-learning')}>
            Volver al aprendizaje
          </Button>
        </div>
      </div>
    </div>
  );
}
