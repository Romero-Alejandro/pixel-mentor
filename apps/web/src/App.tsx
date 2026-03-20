import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo } from 'react';

import { useAuthStore, useAuthRedirect } from './stores/authStore';
import { useGamificationSSE } from './hooks/useGamificationSSE';
import { Spinner } from './components/ui/Spinner';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { LessonPage } from './pages/LessonPage';
import { MissionReportPage } from './pages/MissionReportPage';
import { SessionPage } from './pages/SessionPage';
import { AchievementsPage } from './pages/AchievementsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, isValidating } = useAuthStore();
  const { saveRedirectPath } = useAuthRedirect();
  const location = useLocation();

  useEffect(() => {
    if (isHydrated && !isValidating && !isAuthenticated) {
      saveRedirectPath(location.pathname);
    }
  }, [isHydrated, isValidating, isAuthenticated, location.pathname, saveRedirectPath]);

  if (!isHydrated || isValidating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-2 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, isValidating } = useAuthStore();
  const { getRedirectPath, clearRedirect } = useAuthRedirect();

  const redirectPath = getRedirectPath();

  const isSafePath = useMemo(() => {
    return Boolean(
      redirectPath && !redirectPath.startsWith('/login') && !redirectPath.startsWith('/register'),
    );
  }, [redirectPath]);

  useEffect(() => {
    if (isHydrated && !isValidating && isAuthenticated && isSafePath) {
      clearRedirect();
    }
  }, [isHydrated, isValidating, isAuthenticated, isSafePath, clearRedirect]);

  if (!isHydrated || isValidating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (isSafePath && redirectPath) {
      return <Navigate to={redirectPath} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { isAuthenticated } = useAuthStore();
  useGamificationSSE(isAuthenticated);

  return (
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
        path="/mission-report"
        element={
          <ProtectedRoute>
            <MissionReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId"
        element={
          <ProtectedRoute>
            <SessionPage />
          </ProtectedRoute>
        }
      />
      <Route path="/achievements" element={<ProtectedRoute><AchievementsPage /></ProtectedRoute>} />
      <Route path="/test/gamification" element={<GamificationTestPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
