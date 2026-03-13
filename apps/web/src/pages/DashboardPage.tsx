import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';
import { api, type Lesson, type Session } from '../services/api';

export function DashboardPage() {
  const { user, logout } = useAuthStore();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [activeTab, setActiveTab] = useState<'lessons' | 'sessions'>('lessons');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lessonsData, sessionsData] = await Promise.all([
          api.listLessons(true),
          user ? api.listSessions(user.id, false) : Promise.resolve([]),
        ]);
        setLessons(lessonsData);
        setSessions(sessionsData);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingLessons(false);
        setIsLoadingSessions(false);
      }
    };

    fetchData();
  }, [user]);

  const lessonMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const lesson of lessons) map.set(lesson.id, lesson.title);
    return map;
  }, [lessons]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-6 h-6 bg-slate-900 rounded-sm"></div>
            <h1 className="text-base font-semibold tracking-tight">Pixel Mentor</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                Operador
              </span>
              <span className="text-sm font-medium">{user?.name}</span>
            </div>
            <div className="w-px h-4 bg-slate-200"></div>
            <button
              onClick={logout}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              Desconectar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h2 className="text-2xl font-semibold tracking-tight mb-2">Terminal de Control</h2>
          <p className="text-sm text-slate-500">
            Selecciona un módulo o revisa la telemetría de tus sesiones activas.
          </p>
        </div>

        <div className="mb-8">
          <div className="inline-flex p-1 bg-slate-100 rounded-md border border-slate-200/60">
            <button
              onClick={() => setActiveTab('lessons')}
              className={`px-4 py-2 text-sm font-medium rounded transition-all ${
                activeTab === 'lessons'
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Módulos Disponibles
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-4 py-2 text-sm font-medium rounded transition-all ${
                activeTab === 'sessions'
                  ? 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Registro de Sesiones
            </button>
          </div>
        </div>

        {activeTab === 'lessons' ? (
          <div>
            {isLoadingLessons ? (
              <div className="flex items-center justify-center py-24 text-sm text-slate-500 font-mono uppercase tracking-widest">
                Obteniendo telemetría...
              </div>
            ) : lessons.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-md py-24 text-center">
                <p className="text-sm text-slate-500">
                  No se detectaron módulos en este cuadrante.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    to={`/lesson/${lesson.id}`}
                    className="block p-6 bg-white border border-slate-200 rounded-md hover:border-slate-400 transition-colors group flex flex-col h-full"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-base font-semibold leading-tight">{lesson.title}</h3>
                      <span className="text-xs font-mono text-slate-400 group-hover:text-slate-600 transition-colors">
                        {lesson.id.slice(0, 6)}
                      </span>
                    </div>
                    {lesson.description ? (
                      <p className="text-sm text-slate-500 line-clamp-3 mb-6 flex-1">
                        {lesson.description}
                      </p>
                    ) : null}
                    <div className="mt-auto flex items-center gap-2 text-sm font-medium text-slate-900">
                      Iniciar Secuencia
                      <span className="text-slate-400 group-hover:translate-x-1 transition-transform">
                        →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'sessions' ? (
          <div>
            {isLoadingSessions ? (
              <div className="flex items-center justify-center py-24 text-sm text-slate-500 font-mono uppercase tracking-widest">
                Sincronizando registros...
              </div>
            ) : sessions.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-md py-24 text-center">
                <p className="text-sm text-slate-500">Base de datos de sesiones vacía.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-mono text-slate-500 uppercase tracking-wider">
                        ID Referencia
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-mono text-slate-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-mono text-slate-500 uppercase tracking-wider">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {lessonMap.get(session.lessonId) ||
                            `MOD-${session.lessonId.slice(0, 6).toUpperCase()}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-1 text-xs font-mono rounded-sm border ${
                              session.status === 'active'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : session.status === 'completed'
                                  ? 'bg-slate-50 text-slate-600 border-slate-200'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}
                          >
                            {session.status === 'active'
                              ? 'EN_PROGRESO'
                              : session.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Link
                            to={`/session/${session.id}`}
                            className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
                          >
                            Acceder
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
