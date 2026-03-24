import { useEffect, useState, useRef } from 'react';
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
  IconPlayerPlay,
  IconRefresh,
  IconArrowRight,
  IconBolt,
  IconSparkles,
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
import { useAudio } from '@/contexts/AudioContext';
import { AudioControl } from '@/components/AudioControl';

const LEVEL_EMOJIS: Record<number, string> = {
  1: '🌱',
  2: '🌿',
  3: '🌸',
  4: '🌳',
  5: '🌲',
  6: '⛰️',
};

interface LessonContext {
  status: 'available' | 'in-progress' | 'practiced' | 'mastered';
  session?: Session;
  progressPercent?: number;
  currentStep?: number;
  totalSteps?: number;
  actionLabel: string;
  actionIcon: React.ReactNode;
  statusMessage: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '¡Buenos días';
  if (hour < 18) return '¡Buenas tardes';
  return '¡Buenas noches';
}

export function DashboardPage() {
  const { playClick, playClickSecondary, playSelect, playStreakMaintained } = useAudio();
  const { user, logout } = useAuthStore(
    useShallow((state) => ({ user: state.user, logout: state.logout })),
  );
  const { profile, fetchProfile, particleTrigger, recordActivity } = useGamificationStore(
    useShallow((state) => ({
      profile: state.profile,
      fetchProfile: state.fetchProfile,
      particleTrigger: state.particleTrigger,
      recordActivity: state.recordActivity,
    })),
  );

  const prevParticleTrigger = useRef(particleTrigger);

  useEffect(() => {
    if (particleTrigger > prevParticleTrigger.current) {
      playStreakMaintained();
      prevParticleTrigger.current = particleTrigger;
    }
  }, [particleTrigger, playStreakMaintained]);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [achievements, setAchievements] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'streak' | 'badges' | 'progress'>('streak');

  const { playModalOpen } = useAudio();

  useEffect(() => {
    if (!isLoading && recipes.length > 0) {
      setTimeout(() => playModalOpen(), 500);
    }
  }, [isLoading, recipes.length, playModalOpen]);

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
    // Record daily login to track streaks (backend handles deduplication for same day)
    recordActivity('DAILY_LOGIN').catch(() => {});
  }, [user, fetchProfile, recordActivity]);

  const getLessonContext = (recipe: Recipe, index: number): LessonContext => {
    const session = sessions.find((s) => s.recipeId === recipe.id);
    const totalSteps = recipe.steps?.length || 5;

    // No session - available or locked
    if (!session) {
      const isLocked =
        index > 0 &&
        !sessions.some((s) => s.recipeId === recipes[index - 1]?.id && s.status === 'COMPLETED');

      if (isLocked) {
        return {
          status: 'available',
          actionLabel: 'Bloqueada',
          actionIcon: <IconLock className="w-5 h-5" />,
          statusMessage: 'Completa la misión anterior para desbloquear',
        };
      }

      return {
        status: 'available',
        totalSteps,
        actionLabel: '¡A jugar!',
        actionIcon: <IconPlayerPlay className="w-5 h-5" />,
        statusMessage: 'Nueva misión disponible',
      };
    }

    // Completed session
    if (session.status === 'COMPLETED') {
      // totalWrongAnswers accumulates all wrong answers across the session
      const wrongAnswers =
        session.stateCheckpoint?.totalWrongAnswers ??
        session.stateCheckpoint?.failedAttempts ??
        session.failedAttempts ??
        0;
      const isPerfect = wrongAnswers === 0;
      return {
        status: isPerfect ? 'mastered' : 'practiced',
        session,
        totalSteps,
        progressPercent: 100,
        currentStep: totalSteps,
        actionLabel: isPerfect ? 'Repetir' : 'Mejorar',
        actionIcon: <IconRefresh className="w-5 h-5" />,
        statusMessage: isPerfect ? '¡Dominado sin errores!' : 'Completado, ¡puedes mejorar!',
      };
    }

    // In-progress session
    const currentStep = session.stateCheckpoint?.currentStepIndex ?? 0;
    const progressPercent = Math.round((currentStep / totalSteps) * 100);

    return {
      status: 'in-progress',
      session,
      currentStep,
      totalSteps,
      progressPercent,
      actionLabel: 'Seguir',
      actionIcon: <IconArrowRight className="w-5 h-5" />,
      statusMessage: `Paso ${currentStep + 1} de ${totalSteps}`,
    };
  };

  const safeStreakHistory = Array.isArray(achievements?.streakHistory)
    ? achievements.streakHistory
    : [];

  const handleTabChange = (tab: 'streak' | 'badges' | 'progress') => {
    playClick();
    setActiveTab(tab);
  };

  const handleLogout = () => {
    playClickSecondary();
    logout();
  };

  const handleLessonNavigation = () => {
    playSelect();
  };

  const xpPercent = profile
    ? profile.xpToNextLevel > 0
      ? Math.round((profile.totalXP / (profile.totalXP + profile.xpToNextLevel)) * 100)
      : 100
    : 0;

  const completedCount = sessions.filter((s) => s.status === 'COMPLETED').length;
  const levelEmoji = LEVEL_EMOJIS[profile?.currentLevel || 1] ?? '🌱';

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b-4 border-sky-200 shadow-gummy shadow-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-black text-sky-700 tracking-tight flex items-center gap-2">
            <IconMoodSmile className="w-8 h-8 text-amber-400" stroke={2.5} />
            PixelMentor
          </h1>
          <div className="flex items-center gap-4">
            {profile ? <CompactGamificationHeader profile={profile} /> : null}
            <AudioControl />
            <button
              onClick={handleLogout}
              className="text-sm font-bold text-slate-500 hover:text-rose-500 transition-colors px-3 py-2 rounded-xl hover:bg-rose-50"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome message */}
        <div className="mb-8 animate-bounce-in">
          <h2 className="text-3xl sm:text-4xl font-black text-sky-900 tracking-tight">
            {getGreeting()}, explorador! 👋
          </h2>
          <p className="text-lg text-sky-600 font-bold mt-1">
            {completedCount === 0
              ? '¡Tu aventura está por comenzar!'
              : completedCount === 1
                ? '¡Ya completaste tu primera misión! 🎉'
                : `¡Llevas ${completedCount} misiones completadas! 🚀`}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left sidebar */}
          <div className="w-full lg:w-1/3 space-y-6">
            {/* Level card */}
            <div className="bg-white rounded-[2rem] p-6 border-4 border-amber-200 shadow-gummy shadow-amber-200 relative overflow-hidden">
              <div className="absolute -top-4 -right-4 text-7xl opacity-10 select-none">
                {levelEmoji}
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-3xl shadow-lg border-4 border-white">
                  {levelEmoji}
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-600 uppercase tracking-wider">
                    Nivel {profile?.currentLevel || 1}
                  </p>
                  <h2 className="text-xl font-black text-slate-800">
                    {profile?.levelTitle || 'Semilla'}
                  </h2>
                </div>
              </div>
              {profile ? (
                <div className="mt-4 relative z-10">
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-xs font-bold text-slate-500">
                      {profile.totalXP} XP ganados
                    </span>
                    <span className="text-xs font-bold text-amber-600">
                      {profile.xpToNextLevel > 0
                        ? `¡${profile.xpToNextLevel} XP para subir!`
                        : '¡Nivel máximo! 🎉'}
                    </span>
                  </div>
                  <div className="w-full h-5 bg-amber-100 rounded-full overflow-hidden border-2 border-amber-200">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-1000 ease-out relative"
                      style={{ width: `${xpPercent}%` }}
                    >
                      {xpPercent > 15 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-black text-white drop-shadow-sm">
                            {xpPercent}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {profile.xpToNextLevel > 0 && (
                    <p className="text-xs text-slate-400 font-bold mt-1.5 text-center">
                      ¡Sigue jugando para subir de nivel! ⬆️
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {/* Achievements tabs */}
            {achievements ? (
              <div className="bg-white rounded-[2rem] p-6 border-4 border-sky-200 shadow-gummy shadow-sky-200">
                <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-2xl">
                  <button
                    onClick={() => handleTabChange('streak')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-black transition-all ${
                      activeTab === 'streak'
                        ? 'bg-orange-400 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    🔥 Racha
                  </button>
                  <button
                    onClick={() => handleTabChange('badges')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-black transition-all ${
                      activeTab === 'badges'
                        ? 'bg-amber-400 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    🏅 Medallas
                  </button>
                  <button
                    onClick={() => handleTabChange('progress')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-black transition-all ${
                      activeTab === 'progress'
                        ? 'bg-emerald-400 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    📊 Avance
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

          {/* Missions map */}
          <div className="w-full lg:w-2/3">
            <h2 className="text-3xl font-black text-sky-900 mb-8 flex items-center gap-3">
              <IconMap className="w-8 h-8 text-sky-500" stroke={2.5} />
              Mapa de Misiones
            </h2>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Spinner size="lg" className="text-sky-500" />
                <p className="text-lg font-black text-sky-600 animate-pulse">
                  Cargando aventuras...
                </p>
              </div>
            ) : (
              <div className="space-y-6 relative pb-10">
                <div className="absolute left-8 top-10 bottom-10 w-2 bg-sky-200 rounded-full -z-10 hidden sm:block" />

                {recipes.map((recipe, index) => {
                  const context = getLessonContext(recipe, index);
                  const isLocked = context.actionLabel === 'Bloqueada';
                  const isMastered = context.status === 'mastered';
                  const isPracticed = context.status === 'practiced';

                  return (
                    <Card
                      key={recipe.id}
                      variant={isMastered ? 'completed' : isLocked ? 'locked' : 'mission'}
                      className="relative overflow-hidden flex flex-col sm:flex-row items-center gap-6"
                    >
                      {/* Status Icon */}
                      <div
                        className={`w-16 h-16 shrink-0 rounded-full flex items-center justify-center border-4 bg-white z-10 ${
                          isMastered
                            ? 'border-amber-300'
                            : isPracticed
                              ? 'border-sky-200'
                              : context.status === 'in-progress'
                                ? 'border-amber-200'
                                : isLocked
                                  ? 'border-slate-200'
                                  : 'border-sky-200'
                        }`}
                      >
                        {isMastered ? (
                          <IconTrophy className="w-8 h-8 text-amber-500" />
                        ) : isPracticed ? (
                          <IconRefresh className="w-8 h-8 text-sky-500" />
                        ) : context.status === 'in-progress' ? (
                          <IconRocket className="w-8 h-8 text-amber-400 animate-pulse fill-current" />
                        ) : isLocked ? (
                          <IconLock className="w-8 h-8 text-slate-400" />
                        ) : (
                          <IconMapPin className="w-8 h-8 text-sky-400 fill-current" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 text-center sm:text-left">
                        <div className="flex items-center gap-2 justify-center sm:justify-start">
                          <h3 className="text-xl font-bold text-slate-800">{recipe.title}</h3>
                          {isMastered && (
                            <span className="inline-flex items-center gap-0.5 bg-amber-100 border-2 border-amber-200 px-2 py-0.5 rounded-full text-xs font-black text-amber-700">
                              <IconStar className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              Dominado
                            </span>
                          )}
                          {isPracticed && (
                            <span className="inline-flex items-center gap-0.5 bg-sky-100 border-2 border-sky-200 px-2 py-0.5 rounded-full text-xs font-black text-sky-700">
                              <IconRefresh className="w-3.5 h-3.5 text-sky-500" />
                              Practicada
                            </span>
                          )}
                        </div>

                        <p className="text-slate-500 font-medium mt-1 leading-relaxed">
                          {recipe.description}
                        </p>

                        {/* Status Message */}
                        <div
                          className={`mt-2 text-sm font-bold flex items-center gap-1.5 justify-center sm:justify-start ${
                            isMastered
                              ? 'text-amber-600'
                              : isPracticed
                                ? 'text-sky-600'
                                : context.status === 'in-progress'
                                  ? 'text-amber-600'
                                  : isLocked
                                    ? 'text-slate-400'
                                    : 'text-sky-600'
                          }`}
                        >
                          {isMastered ? '🏆' : null}
                          {isPracticed ? '💪' : null}
                          {context.status === 'in-progress' ? '🚀' : null}
                          {isLocked ? '🔒' : null}
                          {context.status === 'available' && !isLocked ? '✨' : null}
                          {context.statusMessage}
                        </div>

                        {/* Progress Bar for in-progress */}
                        {context.status === 'in-progress' &&
                        context.progressPercent !== undefined ? (
                          <div className="mt-3 max-w-xs mx-auto sm:mx-0">
                            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                              <span>Tu progreso</span>
                              <span>{context.progressPercent}%</span>
                            </div>
                            <div className="w-full h-3 bg-amber-100 rounded-full overflow-hidden border-2 border-amber-200">
                              <div
                                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-500"
                                style={{ width: `${context.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        ) : null}

                        {/* XP / Status badges */}
                        <div className="flex items-center justify-center sm:justify-start gap-3 mt-3 text-sm font-bold flex-wrap">
                          {isMastered ? (
                            <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full border-2 border-amber-100">
                              <IconStar className="w-4 h-4 fill-current" /> ¡Dominado!
                            </span>
                          ) : isPracticed ? (
                            <span className="flex items-center gap-1 text-sky-600 bg-sky-50 px-3 py-1 rounded-full border-2 border-sky-100">
                              <IconBolt className="w-4 h-4" /> ¡Inténtalo de nuevo!
                            </span>
                          ) : context.status === 'in-progress' ? (
                            <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full border-2 border-amber-100">
                              <IconRocket className="w-4 h-4" /> En progreso
                            </span>
                          ) : !isLocked ? (
                            <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full border-2 border-amber-100">
                              <IconStar className="w-4 h-4 fill-current" /> Hasta +70 XP
                            </span>
                          ) : null}
                          {recipe.expectedDurationMinutes ? (
                            <span className="flex items-center gap-1 text-sky-600 bg-sky-50 px-3 py-1 rounded-full border-2 border-sky-100">
                              <IconClock className="w-4 h-4" /> {recipe.expectedDurationMinutes} min
                            </span>
                          ) : null}
                          {context.totalSteps && !isLocked ? (
                            <span className="flex items-center gap-1 text-violet-600 bg-violet-50 px-3 py-1 rounded-full border-2 border-violet-100">
                              <IconSparkles className="w-4 h-4" /> {context.totalSteps} retos
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                        {isLocked ? (
                          <Button
                            variant="secondary"
                            className="w-full opacity-50 cursor-not-allowed"
                            disabled
                          >
                            <IconLock className="w-5 h-5 mr-2" /> Bloqueada
                          </Button>
                        ) : (
                          <Link
                            to={`/lesson/${recipe.id}`}
                            className="w-full block"
                            onClick={handleLessonNavigation}
                          >
                            <Button
                              variant={
                                isMastered
                                  ? 'success'
                                  : isPracticed
                                    ? 'secondary'
                                    : context.status === 'in-progress'
                                      ? 'secondary'
                                      : 'primary'
                              }
                              className="w-full shadow-lg flex items-center gap-2"
                            >
                              {context.actionIcon}
                              {context.actionLabel}
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
