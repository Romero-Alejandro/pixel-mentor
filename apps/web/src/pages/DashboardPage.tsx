import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  IconRocket,
  IconStar,
  IconLock,
  IconMoodSmile,
  IconMap,
  IconMapPin,
  IconClock,
  IconTrophy,
  IconFlame,
  IconChartBar,
} from '@tabler/icons-react';

import { useAuthStore } from '../stores/authStore';
import { useGamificationStore } from '../stores/gamification.store';
import { gamificationApi } from '../api/gamification.api';
import { api, type Recipe, type Session } from '../services/api';
import { Button, Card, Spinner } from '../components/ui';
import { CompactGamificationHeader } from '../components/gamification/CompactGamificationHeader';
import { StreakWidget } from '../components/gamification/StreakWidget';

import { StreakCalendar } from '@/components/gamification/StreakCalendar';
import { XPChart } from '@/components/gamification/XPChart';
import { BadgeGrid } from '@/components/gamification/BadgeGrid';

export function DashboardPage() {
  const { user, logout } = useAuthStore(
    useShallow((state) => ({ user: state.user, logout: state.logout })),
  );
  const { profile, fetchProfile } = useGamificationStore(
    useShallow((state) => ({ profile: state.profile, fetchProfile: state.fetchProfile })),
  );

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [achievements, setAchievements] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'streak' | 'badges' | 'progress'>('streak');

  useEffect(() => {
    const loadAdventureData = async () => {
      try {
        const [recipesData, sessionsData, badges, userBadges, streakHistoryResponse] =
          await Promise.all([
            api.listRecipes(true),
            user ? api.listSessions(user.id, false) : Promise.resolve([]),
            gamificationApi.getBadges(),
            gamificationApi.getUserBadges(),
            gamificationApi.getStreakHistory(),
          ]);

        const streakHistory = Array.isArray(streakHistoryResponse)
          ? streakHistoryResponse
          : streakHistoryResponse?.history || [];

        setRecipes(recipesData);
        setSessions(sessionsData);
        setAchievements({
          badges: badges?.allBadges || [],
          userBadges: userBadges?.earnedBadges || [],
          streakHistory: streakHistory,
        });
      } catch (e) {
      } finally {
        setIsLoading(false);
      }
    };

    loadAdventureData();
    fetchProfile().catch(() => {});
  }, [user, fetchProfile]);

  const getMissionStatus = (recipeId: string) => {
    const session = sessions.find((s) => s.recipeId === recipeId);
    if (!session) return 'available';
    if (session.status === 'COMPLETED') return 'completed';
    return 'in-progress';
  };

  const safeStreakHistory = Array.isArray(achievements?.streakHistory)
    ? achievements.streakHistory
    : [];

  return (
    <div className="min-h-screen bg-[#f0f9ff] text-slate-800 pb-20 font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b-4 border-sky-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center shadow-gummy shadow-amber-fun-dark border-2 border-amber-fun-dark rotate-3">
              <IconRocket className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-sky-900 hidden sm:block">
              Pixel Mentor
            </h1>
          </div>

          <div className="flex items-center gap-6">
            {profile ? <CompactGamificationHeader profile={profile} /> : null}
            <Button variant="danger" size="sm" onClick={logout}>
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-10">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="w-full lg:w-1/3 space-y-6">
            <div className="bg-white rounded-[2rem] p-6 border-4 border-amber-200 shadow-gummy shadow-amber-200 text-center animate-bounce-in">
              <div className="w-20 h-20 mx-auto bg-sky-100 rounded-full flex items-center justify-center mb-4 border-4 border-sky-300">
                <IconMoodSmile className="w-10 h-10 text-sky-500" stroke={2.5} />
              </div>
              <h2 className="text-xl font-black text-slate-800">¡Hola, {user?.name}!</h2>

              {profile ? (
                <div className="mt-4 pt-4 border-t-4 border-slate-100 border-dashed">
                  <div className="h-6 bg-slate-200 rounded-full overflow-hidden border-2 border-slate-300 relative shadow-inner">
                    <div
                      className="h-full bg-amber-400 transition-all duration-1000"
                      style={{
                        width: `${
                          profile.xpToNextLevel > 0
                            ? ((profile.totalXP % profile.xpToNextLevel) / profile.xpToNextLevel) *
                              100
                            : 100
                        }%`,
                      }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-700">
                      {profile.totalXP % (profile.xpToNextLevel || 1)} /{' '}
                      {profile.xpToNextLevel || 'Max'} XP
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-wider">
                    Nivel {profile.currentLevel}: {profile.levelTitle}
                  </p>
                </div>
              ) : null}
            </div>

            {achievements ? (
              <div className="bg-white rounded-[2rem] p-6 border-4 border-sky-200 shadow-gummy shadow-sky-200">
                <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-2xl">
                  <button
                    onClick={() => setActiveTab('streak')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all ${
                      activeTab === 'streak'
                        ? 'bg-orange-400 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <IconFlame className="w-4 h-4" /> Racha
                  </button>
                  <button
                    onClick={() => setActiveTab('badges')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all ${
                      activeTab === 'badges'
                        ? 'bg-amber-400 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <IconTrophy className="w-4 h-4" /> Medallas
                  </button>
                  <button
                    onClick={() => setActiveTab('progress')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all ${
                      activeTab === 'progress'
                        ? 'bg-emerald-400 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <IconChartBar className="w-4 h-4" /> Avance
                  </button>
                </div>

                <div className="min-h-[220px]">
                  {activeTab === 'streak' && profile ? (
                    <div className="space-y-4 animate-in fade-in zoom-in-95">
                      <StreakWidget
                        currentStreak={profile.currentStreak}
                        longestStreak={profile.longestStreak}
                        className="w-full shadow-none border-2"
                      />
                      <StreakCalendar history={safeStreakHistory.slice(-14)} />
                    </div>
                  ) : null}

                  {activeTab === 'badges' ? (
                    <div className="animate-in fade-in zoom-in-95 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      <BadgeGrid
                        allBadges={achievements.badges}
                        earnedBadges={achievements.userBadges}
                      />
                    </div>
                  ) : null}

                  {activeTab === 'progress' ? (
                    <div className="animate-in fade-in zoom-in-95">
                      <XPChart data={safeStreakHistory.slice(-7)} />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="w-full lg:w-2/3">
            <h2 className="text-3xl font-black text-sky-900 mb-8 flex items-center gap-3">
              <IconMap className="w-8 h-8 text-sky-500" stroke={2.5} />
              Mapa de Misiones
            </h2>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Spinner size="lg" className="text-sky-500" />
              </div>
            ) : (
              <div className="space-y-6 relative pb-10">
                <div className="absolute left-8 top-10 bottom-10 w-2 bg-sky-200 rounded-full -z-10 hidden sm:block" />

                {recipes.map((recipe, index) => {
                  const status = getMissionStatus(recipe.id);
                  return (
                    <Card
                      key={recipe.id}
                      variant={
                        status === 'completed'
                          ? 'completed'
                          : status === 'available' && index > 1
                            ? 'locked'
                            : 'mission'
                      }
                      className="relative overflow-hidden flex flex-col sm:flex-row items-center gap-6"
                    >
                      <div
                        className={`w-16 h-16 shrink-0 rounded-full flex items-center justify-center border-4 bg-white z-10 ${
                          status === 'completed'
                            ? 'border-emerald-200'
                            : status === 'in-progress'
                              ? 'border-amber-200'
                              : 'border-sky-200'
                        }`}
                      >
                        {status === 'completed' ? (
                          <IconStar className="w-8 h-8 text-emerald-400 fill-current" />
                        ) : status === 'in-progress' ? (
                          <IconRocket className="w-8 h-8 text-amber-400 animate-pulse fill-current" />
                        ) : (
                          <IconMapPin className="w-8 h-8 text-sky-400 fill-current" />
                        )}
                      </div>

                      <div className="flex-1 text-center sm:text-left">
                        <h3 className="text-xl font-bold text-slate-800">{recipe.title}</h3>
                        <p className="text-slate-500 font-medium mt-1 leading-relaxed">
                          {recipe.description}
                        </p>

                        <div className="flex items-center justify-center sm:justify-start gap-3 mt-3 text-sm font-bold">
                          <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full border-2 border-amber-100">
                            <IconStar className="w-4 h-4 fill-current" /> +50 XP
                          </span>
                          {recipe.expectedDurationMinutes ? (
                            <span className="flex items-center gap-1 text-sky-600 bg-sky-50 px-3 py-1 rounded-full border-2 border-sky-100">
                              <IconClock className="w-4 h-4" /> {recipe.expectedDurationMinutes} min
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                        {status === 'completed' ? (
                          <Button variant="success" className="w-full" disabled>
                            ¡Completada!
                          </Button>
                        ) : status === 'locked' && index > 1 ? (
                          <Button
                            variant="secondary"
                            className="w-full opacity-50 cursor-not-allowed"
                            disabled
                          >
                            <IconLock className="w-5 h-5 mr-2" /> Bloqueada
                          </Button>
                        ) : (
                          <Link to={`/lesson/${recipe.id}`} className="w-full block">
                            <Button
                              variant={status === 'in-progress' ? 'secondary' : 'primary'}
                              className="w-full shadow-lg"
                            >
                              {status === 'in-progress' ? 'Continuar' : '¡Jugar ahora!'}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
