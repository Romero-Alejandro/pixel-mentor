import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  IconMoodSmile,
  IconMap,
  IconSchool,
  IconUsers,
  IconListDetails,
  IconUsersGroup,
  IconLogout,
} from '@tabler/icons-react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useGamificationStore } from '@/features/gamification/stores/gamification.store';
import { Spinner } from '@/components/ui';
import { CompactGamificationHeader } from '@/features/gamification/components/CompactGamificationHeader';
import { StreakWidget } from '@/features/gamification/components/StreakWidget';
import { StreakCalendar } from '@/features/gamification/components/StreakCalendar';
import { XPChart } from '@/features/gamification/components/XPChart';
import { BadgeGrid } from '@/features/gamification/components/BadgeGrid';
import { useAudio } from '@/contexts/AudioContext';
import { useToast } from '@/contexts/ToastContext';
import { AudioControl } from '@/components/AudioControl';
import {
  DASHBOARD_TABS,
  LEVEL_EMOJIS,
  getGreeting,
  type DashboardTab,
} from '@/features/dashboard/constants/dashboard.constants';
import { useDashboardData } from '@/features/dashboard/hooks/useDashboardData';
import { MissionMap } from '@/features/dashboard/components/MissionMap';

export function DashboardPage() {
  const navigate = useNavigate();
  const { playClick, playClickSecondary, playSelect, playStreakMaintained, playModalOpen } =
    useAudio();
  const toast = useToast();

  const { user, logout, isLoggingOut } = useAuth();

  const { profile, fetchProfile, particleTrigger, recordActivity } = useGamificationStore(
    useShallow((state) => ({
      profile: state.profile,
      fetchProfile: state.fetchProfile,
      particleTrigger: state.particleTrigger,
      recordActivity: state.recordActivity,
    })),
  );

  const prevParticleTrigger = useRef(particleTrigger);
  const { classes, sessions, achievements, isLoading } = useDashboardData(user ?? null);
  const [activeTab, setActiveTab] = useState<DashboardTab>(DASHBOARD_TABS.STREAK);

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (particleTrigger > prevParticleTrigger.current) {
      playStreakMaintained();
      prevParticleTrigger.current = particleTrigger;
    }
  }, [particleTrigger, playStreakMaintained]);

  useEffect(() => {
    if (!isLoading && classes.length > 0) {
      setTimeout(() => playModalOpen(), 500);
    }
  }, [isLoading, classes.length, playModalOpen]);

  useEffect(() => {
    fetchProfile().catch(() => {});
    recordActivity('DAILY_LOGIN').catch(() => {});
  }, [fetchProfile, recordActivity]);

  function handleTabChange(tab: DashboardTab) {
    playClick();
    setActiveTab(tab);
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    playClickSecondary();

    try {
      await logout();
      toast.success('¡Sesión cerrada!', { message: 'Hasta pronto' });
      navigate('/login', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cerrar sesión';
      toast.error(message);
    }
  }

  const xpPercent =
    profile && profile.xpToNextLevel > 0
      ? Math.round((profile.totalXP / (profile.totalXP + profile.xpToNextLevel)) * 100)
      : 100;

  const completedCount = sessions.filter((s) => s.status === 'COMPLETED').length;
  const levelEmoji = LEVEL_EMOJIS[profile?.currentLevel || 1] ?? '🌱';
  const safeStreakHistory = Array.isArray(achievements?.streakHistory)
    ? achievements.streakHistory
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 font-sans text-slate-800">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b-4 border-sky-200 shadow-[0_4px_0_0_#bae6fd]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-black text-sky-700 tracking-tight flex items-center gap-2">
            <IconMoodSmile className="w-8 h-8 text-amber-400" stroke={2.5} /> PixelMentor
          </h1>

          <div className="flex items-center gap-4">
            {isTeacher ? (
              <nav className="hidden sm:flex items-center gap-2 mr-4">
                <Link
                  to="/classes"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-sky-600 hover:bg-sky-50 transition-colors outline-none"
                >
                  <IconSchool className="w-4 h-4" /> Clases
                </Link>
                <Link
                  to="/units"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-sky-600 hover:bg-sky-50 transition-colors outline-none"
                >
                  <IconListDetails className="w-4 h-4" /> Unidades
                </Link>
                <Link
                  to="/groups"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors outline-none"
                >
                  <IconUsersGroup className="w-4 h-4" /> Grupos
                </Link>
                {isAdmin ? (
                  <Link
                    to="/admin/users"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-violet-600 hover:bg-violet-50 transition-colors outline-none"
                  >
                    <IconUsers className="w-4 h-4" /> Usuarios
                  </Link>
                ) : null}
              </nav>
            ) : null}

            {!isTeacher ? (
              <nav className="hidden sm:flex items-center gap-2 mr-4">
                <Link
                  to="/my-learning"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors outline-none"
                >
                  <IconMap className="w-4 h-4" /> Mi Aprendizaje
                </Link>
              </nav>
            ) : null}

            {profile ? <CompactGamificationHeader profile={profile} /> : null}
            <AudioControl />
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-sm font-bold text-slate-500 hover:text-rose-500 transition-colors px-3 py-2 rounded-xl hover:bg-rose-50 outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-500 flex items-center gap-1.5"
            >
              {isLoggingOut ? (
                <Spinner size="sm" className="text-rose-500" />
              ) : (
                <IconLogout className="w-4 h-4" />
              )}
              {isLoggingOut ? 'Saliendo...' : 'Salir'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 animate-bounce-in">
          <h2 className="text-3xl sm:text-4xl font-black text-sky-900 tracking-tight">
            {getGreeting()}, {user?.name || 'explorador'}! 👋
          </h2>
          <p className="text-lg text-sky-600 font-bold mt-1">
            {isTeacher
              ? `Panel de ${isAdmin ? 'administración' : 'profesor'}`
              : completedCount === 0
                ? '¡Tu aventura está por comenzar!'
                : `¡Llevas ${completedCount} misiones completadas! 🚀`}
          </p>
        </div>

        {isTeacher ? (
          <>
            {/* Info banner */}
            <div className="mb-6 bg-white rounded-2xl p-5 border-2 border-sky-100 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <IconSchool className="w-5 h-5 text-sky-500" />
                    <h3 className="font-bold text-slate-800">Clases</h3>
                  </div>
                  <p className="text-sm text-slate-500">
                    Agrupan lecciones para tus estudiantes. Cada clase contiene lecciones ordenadas
                    que usan unidades como contenido.
                  </p>
                </div>
                <div className="hidden sm:block w-px bg-sky-100" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <IconListDetails className="w-5 h-5 text-purple-500" />
                    <h3 className="font-bold text-slate-800">Unidades</h3>
                  </div>
                  <p className="text-sm text-slate-500">
                    Contenido pedagógico con pasos (intro, contenido, actividades, preguntas). Se
                    reutilizan en múltiples clases.
                  </p>
                </div>
              </div>
            </div>

            {/* Action cards */}
            <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-bounce-in">
              <Link to="/classes" className="group outline-none">
                <div className="bg-white rounded-[2rem] p-6 border-4 border-sky-200 shadow-[0_6px_0_0_#bae6fd] hover:border-sky-300 hover:shadow-[0_8px_0_0_#7dd3fc] transition-all hover:-translate-y-1 active:translate-y-1 active:shadow-none">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-sky-100 flex items-center justify-center group-hover:bg-sky-200 transition-colors">
                      <IconSchool className="w-7 h-7 text-sky-500" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-lg">Mis Clases</h3>
                      <p className="text-sm text-slate-500 font-medium">
                        Crear y gestionar clases para estudiantes
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
              <Link to="/units" className="group outline-none">
                <div className="bg-white rounded-[2rem] p-6 border-4 border-purple-200 shadow-[0_6px_0_0_#e9d5ff] hover:border-purple-300 hover:shadow-[0_8px_0_0_#d8b4fe] transition-all hover:-translate-y-1 active:translate-y-1 active:shadow-none">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                      <IconListDetails className="w-7 h-7 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-lg">Unidades de Aprendizaje</h3>
                      <p className="text-sm text-slate-500 font-medium">
                        Crear contenido para tus clases
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </>
        ) : null}

        {!isTeacher ? (
          <div className="mb-8 animate-bounce-in">
            <Link to="/my-learning" className="group outline-none">
              <div className="bg-white rounded-[2rem] p-6 border-4 border-emerald-200 shadow-[0_6px_0_0_#a7f3d0] hover:border-emerald-300 hover:shadow-[0_8px_0_0_#6ee7b7] transition-all hover:-translate-y-1 active:translate-y-1 active:shadow-none">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <IconMap className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg">Mi Camino de Aprendizaje</h3>
                    <p className="text-sm text-slate-500 font-medium">
                      Ver tus grupos y clases asignadas
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ) : null}

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-1/3 space-y-6">
            <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border-4 border-amber-200 shadow-[0_8px_0_0_#fde68a] relative overflow-hidden">
              <div className="absolute -top-6 -right-6 text-8xl opacity-10 select-none blur-[2px]">
                {levelEmoji}
              </div>

              <div className="flex items-center gap-5 relative z-10">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center text-4xl shadow-[0_4px_0_0_#d97706] border-4 border-white animate-float">
                  {levelEmoji}
                </div>
                <div>
                  <p className="text-sm font-black text-amber-600 uppercase tracking-widest bg-amber-100 inline-block px-3 py-1 rounded-full border-2 border-amber-200 mb-1">
                    Nivel {profile?.currentLevel || 1}
                  </p>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                    {profile?.levelTitle || 'Semilla'}
                  </h2>
                </div>
              </div>

              {profile ? (
                <div className="mt-6 relative z-10 bg-slate-50 p-4 rounded-[1.5rem] border-2 border-slate-100">
                  <div className="flex justify-between items-end mb-2 text-xs font-black uppercase tracking-wider">
                    <span className="text-slate-500">{profile.totalXP} XP Ganados</span>
                    <span className="text-amber-600">
                      {profile.xpToNextLevel > 0
                        ? `¡Faltan ${profile.xpToNextLevel} XP!`
                        : '¡Nivel Máximo! 🎉'}
                    </span>
                  </div>
                  <div className="w-full h-6 bg-amber-100 rounded-full overflow-hidden border-4 border-amber-200 shadow-inner relative">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${xpPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {achievements ? (
              <div className="bg-white rounded-[2.5rem] p-6 border-4 border-sky-200 shadow-[0_8px_0_0_#bae6fd]">
                <div className="flex gap-2 mb-6 bg-slate-100 p-2 rounded-[1.5rem] border-2 border-slate-200">
                  {Object.values(DASHBOARD_TABS).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      className={`flex-1 py-3 rounded-xl text-sm font-black transition-all capitalize outline-none ${
                        activeTab === tab
                          ? 'bg-sky-500 text-white shadow-[0_4px_0_0_#0284c7] -translate-y-1'
                          : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                      }`}
                    >
                      {tab === DASHBOARD_TABS.STREAK
                        ? '🔥 Racha'
                        : tab === DASHBOARD_TABS.BADGES
                          ? '🏅 Medallas'
                          : '📊 Avance'}
                    </button>
                  ))}
                </div>

                <div className="min-h-[220px] p-2">
                  {activeTab === DASHBOARD_TABS.STREAK && profile ? (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                      <StreakWidget
                        currentStreak={profile.currentStreak}
                        longestStreak={profile.longestStreak}
                        className="w-full shadow-none border-4 border-orange-100 bg-orange-50/50 rounded-[1.5rem]"
                      />
                      <StreakCalendar history={safeStreakHistory.slice(-14)} />
                    </div>
                  ) : null}
                  {activeTab === DASHBOARD_TABS.BADGES ? (
                    <div className="animate-in fade-in zoom-in-95 duration-300 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      <BadgeGrid
                        allBadges={achievements.badges}
                        earnedBadges={achievements.userBadges}
                      />
                    </div>
                  ) : null}
                  {activeTab === DASHBOARD_TABS.PROGRESS ? (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                      <XPChart
                        data={
                          safeStreakHistory.slice(-7) as unknown as {
                            date: string;
                            xp: number;
                          }[]
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="w-full lg:w-2/3 bg-white/80 backdrop-blur-md rounded-[3rem] border-4 border-white shadow-[0_8px_32px_rgba(56,189,248,0.15)] p-6 sm:p-10 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/pattern-dots.svg')] bg-repeat opacity-5 pointer-events-none" />

            <h2 className="text-3xl font-black text-sky-900 mb-2 flex items-center gap-3 relative z-10">
              <IconMap className="w-10 h-10 text-sky-500 drop-shadow-sm" stroke={3} />
              Mapa de Aventuras
            </h2>
            <p className="text-slate-500 font-bold mb-8 text-lg relative z-10">
              Elige tu próximo desafío y descubre nuevos caminos.
            </p>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-6 relative z-10">
                <div className="w-24 h-24 bg-sky-100 rounded-full flex items-center justify-center border-4 border-sky-200 shadow-[0_8px_0_0_#bae6fd]">
                  <Spinner size="lg" className="text-sky-500" />
                </div>
                <p className="text-xl font-black text-sky-600 animate-pulse uppercase tracking-widest">
                  Desplegando el mapa mágico...
                </p>
              </div>
            ) : (
              <MissionMap classes={classes} sessions={sessions} onInteract={playSelect} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
