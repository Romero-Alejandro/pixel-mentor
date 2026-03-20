import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  IconLogout,
  IconBooks,
  IconHistory,
  IconRocket,
  IconArrowRight,
  IconX,
  IconPlayerPlay,
} from '@tabler/icons-react';

import { useAuthStore } from '../stores/authStore';
import { useAutoSelect } from '../hooks/useAutoSelect';
import { useGamificationStore } from '../stores/gamification.store';
import { api, type Recipe, type Session } from '../services/api';
import { Button, Card, Badge, Spinner, CardSkeleton } from '../components/ui';
import { GamificationHeader } from '../components/gamification/GamificationHeader';

const isResumable = (status: string): boolean => {
  return ['IDLE', 'ACTIVE', 'PAUSED_FOR_QUESTION', 'AWAITING_CONFIRMATION', 'PAUSED_IDLE'].includes(
    status,
  );
};

const getStatusBadge = (status: string) => {
  if (isResumable(status)) {
    return (
      <Badge variant="warning" className="flex items-center gap-1">
        🔄 En progreso
      </Badge>
    );
  }
  if (status === 'COMPLETED') {
    return (
      <Badge variant="success" className="flex items-center gap-1">
        ✓ Completado
      </Badge>
    );
  }
  if (status === 'ESCALATED') {
    return (
      <Badge variant="danger" className="flex items-center gap-1">
        ⚠️ Escalado
      </Badge>
    );
  }
  return <Badge>{status}</Badge>;
};

export function DashboardPage() {
  const { user, logout } = useAuthStore();
  const { profile, fetchProfile } = useGamificationStore();

  const { getSessionToResume } = useAutoSelect(user?.id || null, {
    autoResume: true,
  });

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [activeTab, setActiveTab] = useState<'recipes' | 'sessions'>('recipes');
  const [completingSessionId, setCompletingSessionId] = useState<string | null>(null);
  const [suggestedSession, setSuggestedSession] = useState<Session | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recipesData, sessionsData] = await Promise.all([
          api.listRecipes(true),
          user ? api.listSessions(user.id, false) : Promise.resolve([]),
        ]);
        setRecipes(recipesData);
        setSessions(sessionsData);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingRecipes(false);
        setIsLoadingSessions(false);
      }
    };

    fetchData();

    // Fetch gamification profile (fire-and-forget)
    fetchProfile().catch(() => {});
  }, [user, fetchProfile]);

  useEffect(() => {
    if (!isLoadingSessions && sessions.length > 0) {
      const sessionToResumeId = getSessionToResume();
      if (sessionToResumeId) {
        const session = sessions.find((s) => s.id === sessionToResumeId);
        if (session) {
          setSuggestedSession(session);
        }
      }
    } else if (
      !isLoadingRecipes &&
      !isLoadingSessions &&
      recipes.length === 1 &&
      sessions.length === 0
    ) {
      setSuggestedSession({ id: 'new', recipeId: recipes[0].id, status: 'IDLE' } as Session);
    }
  }, [isLoadingSessions, isLoadingRecipes, sessions, recipes, getSessionToResume]);

  const handleCompleteSession = async (sessionId: string) => {
    if (!confirm('¿Estás seguro de que quieres terminar esta sesión?')) return;

    setCompletingSessionId(sessionId);
    try {
      await api.completeSession(sessionId);
      if (user) {
        const sessionsData = await api.listSessions(user.id, false);
        setSessions(sessionsData);
      }
    } catch (e) {
      alert('Error al terminar la sesión');
    } finally {
      setCompletingSessionId(null);
    }
  };

  const recipeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const recipe of recipes) map.set(recipe.id, recipe.title);
    return map;
  }, [recipes]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-sky-600 rounded-lg flex items-center justify-center">
              <IconRocket className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-800">Pixel Mentor</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Hola,
              </span>
              <span className="text-sm font-semibold text-slate-800">{user?.name}</span>
            </div>
            <div className="w-px h-5 bg-slate-200"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-slate-500 hover:text-slate-700"
            >
              <IconLogout className="w-4 h-4 mr-1" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Gamification Header */}
      {profile ? (
        <div className="max-w-6xl mx-auto px-6 mt-6">
          <GamificationHeader profile={profile} />
        </div>
      ) : null}

      <main className="max-w-6xl mx-auto px-6 py-8">
        {suggestedSession ? (
          <div className="mb-8 p-6 bg-gradient-to-r from-amber-100 to-orange-100 border-2 border-amber-200 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🚀</div>
              <div>
                <h2 className="text-xl font-bold text-amber-900">¡Tu misión te espera!</h2>
                <p className="text-amber-700 font-medium">
                  {suggestedSession.id === 'new'
                    ? 'Tienes un módulo listo para explorar.'
                    : `Dejaste la clase "${recipeMap.get(suggestedSession.recipeId) || 'Módulo'}" por la mitad.`}
                </p>
              </div>
            </div>
            <Link to={`/lesson/${suggestedSession.recipeId}`}>
              <Button
                size="lg"
                className="bg-amber-500 hover:bg-amber-600 text-white border-none shadow-md"
              >
                <IconPlayerPlay className="w-5 h-5 mr-2" />
                Continuar Misión
              </Button>
            </Link>
          </div>
        ) : null}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Mis Clases</h2>
          <p className="text-slate-500">Explora los módulos disponibles o revisa tu historial.</p>
        </div>

        <div className="mb-6">
          <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
            <button
              onClick={() => setActiveTab('recipes')}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'recipes'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <IconBooks className="w-4 h-4" />
              Módulos
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'sessions'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <IconHistory className="w-4 h-4" />
              Historial
            </button>
          </div>
        </div>

        {activeTab === 'recipes' ? (
          <div>
            {isLoadingRecipes ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : recipes.length === 0 ? (
              <Card variant="outlined" className="text-center py-12">
                <IconBooks className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No hay módulos disponibles.</p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recipes.map((recipe) => (
                  <Link key={recipe.id} to={`/lesson/${recipe.id}`} className="group">
                    <Card
                      variant="outlined"
                      padding="lg"
                      className="h-full hover:border-sky-300 hover:shadow-lg hover:shadow-sky-100 transition-all duration-200 flex flex-col"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-base font-semibold text-slate-800 line-clamp-2">
                          {recipe.title}
                        </h3>
                      </div>
                      {recipe.description ? (
                        <p className="text-sm text-slate-500 line-clamp-3 mb-4">
                          {recipe.description}
                        </p>
                      ) : (
                        <div className="mb-4" />
                      )}
                      <div className="flex items-center text-sm font-medium text-sky-600 mt-auto">
                        <span>Comenzar</span>
                        <IconArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {isLoadingSessions ? (
              <Card variant="outlined" padding="lg">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-3">
                      <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
                      <div className="w-20 h-6 bg-slate-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </Card>
            ) : sessions.length === 0 ? (
              <Card variant="outlined" className="text-center py-12">
                <IconHistory className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No hay sesiones en el historial.</p>
              </Card>
            ) : (
              <Card variant="outlined" padding="none" className="overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Módulo
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-800">
                            {recipeMap.get(session.recipeId) ||
                              `MOD-${session.recipeId.slice(0, 6).toUpperCase()}`}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(session.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {isResumable(session.status) ? (
                            <div className="flex items-center justify-end gap-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCompleteSession(session.id)}
                                disabled={completingSessionId === session.id}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                {completingSessionId === session.id ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <>
                                    <IconX className="w-4 h-4 mr-1" />
                                    Terminar
                                  </>
                                )}
                              </Button>
                              <span className="text-slate-300">|</span>
                              <Link
                                to={`/lesson/${session.recipeId}`}
                                className="text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
                              >
                                Continuar
                                <IconArrowRight className="w-4 h-4 inline ml-1" />
                              </Link>
                            </div>
                          ) : (
                            <Link
                              to={`/lesson/${session.recipeId}`}
                              className="text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                            >
                              Ver
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
