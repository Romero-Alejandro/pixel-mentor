import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { useAuthRedirect } from '@/features/auth/stores/auth.store';
import { preloadMascot } from '@/components/mascot/mascot-preload';
import { useGamificationSSE } from '@/features/gamification/hooks/use-gamification-sse';
import { ErrorBoundary, Spinner } from '@/components/ui';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LessonPage } from '@/pages/LessonPage';
import { MissionReportPage } from '@/pages/MissionReportPage';
import { ClassListPage } from '@/pages/ClassListPage';
import { ClassEditorPage } from '@/pages/ClassEditorPage';
import { ClassTemplatesPage } from '@/pages/ClassTemplatesPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { RecipesPage } from '@/pages/RecipesPage';
import { RecipeEditorPage } from '@/pages/RecipeEditorPage';
import { GamificationTestPage } from '@/pages/GamificationTestPage';
import { LongTextTestPage } from '@/pages/LongTextTestPage';
import { GroupListPage } from '@/pages/GroupListPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { MyLearningPage } from '@/pages/MyLearningPage';
import { ClassLessonsPage } from '@/pages/ClassLessonsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isHydrated } = useAuth();
  const { saveRedirectPath } = useAuthRedirect();
  const location = useLocation();

  useEffect(() => {
    // Only save redirect after hydration is complete to avoid false redirects
    if (isHydrated && !isLoading && !isAuthenticated) {
      saveRedirectPath(location.pathname);
    }
  }, [isHydrated, isLoading, isAuthenticated, location.pathname, saveRedirectPath]);

  // Safety: if not authenticated after hydration + loading complete, force redirect
  // This catches cases where the interceptor's redirect doesn't fire
  useEffect(() => {
    if (isHydrated && !isLoading && !isAuthenticated) {
      const timer = setTimeout(() => {
        window.location.href = '/login';
      }, 2_000);
      return () => clearTimeout(timer);
    }
    // When user IS authenticated, any pending timer is cleaned up by the
    // return () => clearTimeout(timer) above — no extra cleanup needed.
  }, [isHydrated, isLoading, isAuthenticated]);

  // Show minimal placeholder while waiting for hydration
  // This prevents showing the spinner during the brief moment before Zustand/React Query settles
  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f9ff]">
        <div className="text-center">
          <Spinner size="lg" className="text-sky-500" />
          <p className="mt-4 text-sky-800 font-bold">Verificando pase de explorador...</p>
        </div>
      </div>
    );
  }

  // Show spinner only after hydration but still loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f9ff]">
        <div className="text-center">
          <Spinner size="lg" className="text-sky-500" />
          <p className="mt-4 text-sky-800 font-bold">Verificando pase de explorador...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — let the interceptor handle redirect to /login
  // Do NOT use <Navigate> here because it causes a client-side navigation
  // that races with the interceptor's hard redirect, leaving the user stuck
  // on a spinner. The interceptor's window.location.href = '/login' is the
  // authoritative redirect path.
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f9ff]">
        <div className="text-center">
          <Spinner size="lg" className="text-sky-500" />
          <p className="mt-4 text-sky-800 font-bold">Redirigiendo al inicio de sesion...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  // isProtected: false means no user query - always hydrated
  const { isAuthenticated, isLoading } = useAuth({ isProtected: false });
  const { getRedirectPath, clearRedirect } = useAuthRedirect();
  const navigate = useNavigate();

  const redirectPath = getRedirectPath();

  const isSafePath = Boolean(
    redirectPath && !redirectPath.startsWith('/login') && !redirectPath.startsWith('/register'),
  );

  // For public routes, isHydrated is always true since no user query is fetched
  useEffect(() => {
    if (!isLoading && isSafePath) {
      clearRedirect();
    }
  }, [isLoading, isSafePath, clearRedirect]);

  useEffect(() => {
    if (isAuthenticated) {
      const target = isSafePath && redirectPath ? redirectPath : '/dashboard';
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, isSafePath, redirectPath, navigate]);

  // Public routes don't need hydration check since isProtected=false
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f9ff]">
        <div className="text-center">
          <Spinner size="lg" className="text-sky-500" />
          <p className="mt-4 text-sky-800 font-bold">Cargando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isHydrated, user } = useAuth();

  // Wait for hydration before showing any loading state
  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f9ff]">
        <div className="text-center">
          <Spinner size="lg" className="text-sky-500" />
          <p className="mt-4 text-sky-800 font-bold">Verificando...</p>
        </div>
      </div>
    );
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f9ff]">
        <div className="text-center">
          <Spinner size="lg" className="text-sky-500" />
          <p className="mt-4 text-sky-800 font-bold">Verificando...</p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'TEACHER' && user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated } = useAuth();
  useGamificationSSE(isAuthenticated);

  // Warm the lesson mascot (Rive chunk + scene bytes) while idle so the
  // first LessonPage mount is instant. Best effort, never on any hot path.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) preloadMascot();
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run);
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const timer = window.setTimeout(run, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lesson/:lessonId"
          element={
            <ProtectedRoute>
              <LessonPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes/:classId/lessons"
          element={
            <ProtectedRoute>
              <ClassLessonsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mission-report"
          element={
            <ProtectedRoute>
              <MissionReportPage />
            </ProtectedRoute>
          }
        />
        {/* Class Routes - Teacher only */}
        <Route
          path="/classes"
          element={
            <ProtectedRoute>
              <TeacherRoute>
                <ClassListPage />
              </TeacherRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes/new"
          element={
            <ProtectedRoute>
              <TeacherRoute>
                <ClassEditorPage />
              </TeacherRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes/:classId/edit"
          element={
            <ProtectedRoute>
              <TeacherRoute>
                <ClassEditorPage />
              </TeacherRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute>
              <TeacherRoute>
                <ClassTemplatesPage />
              </TeacherRoute>
            </ProtectedRoute>
          }
        />
        {/* Admin Routes */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <TeacherRoute>
                <AdminUsersPage />
              </TeacherRoute>
            </ProtectedRoute>
          }
        />
        {/* Unit Routes - Teacher only */}
        <Route
          path="/units"
          element={
            <ProtectedRoute>
              <TeacherRoute>
                <RecipesPage />
              </TeacherRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/units/new/edit"
          element={
            <ProtectedRoute>
              <TeacherRoute>
                <RecipeEditorPage />
              </TeacherRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/units/:recipeId/edit"
          element={
            <ProtectedRoute>
              <TeacherRoute>
                <RecipeEditorPage />
              </TeacherRoute>
            </ProtectedRoute>
          }
        />
        {/* Test Routes (no auth required) - only available in development/E2E mode */}
        <Route path="/test/gamification" element={<GamificationTestPage />} />
        <Route path="/test/lesson-long-text" element={<LongTextTestPage />} />

        {/* Group Routes - Teacher only */}
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <TeacherRoute>
                <GroupListPage />
              </TeacherRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:groupId"
          element={
            <ProtectedRoute>
              <TeacherRoute>
                <GroupDetailPage />
              </TeacherRoute>
            </ProtectedRoute>
          }
        />

        {/* Student Learning Routes */}
        <Route
          path="/my-learning"
          element={
            <ProtectedRoute>
              <MyLearningPage />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
