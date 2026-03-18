import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import { useAuthStore, useAuthRedirect } from './stores/authStore';
import { Spinner } from './components/ui/Spinner';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { LessonPage } from './pages/LessonPage';
import { MissionReportPage } from './pages/MissionReportPage';
import { SessionPage } from './pages/SessionPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, isValidating } = useAuthStore();
  const { saveRedirectPath } = useAuthRedirect();
  const location = useLocation();

  // Wait for hydration before deciding
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
    // Save the current location to redirect back after login
    saveRedirectPath(location.pathname);
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, isValidating } = useAuthStore();
  const { getRedirectPath, clearRedirect } = useAuthRedirect();

  // Wait for hydration before deciding
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
    const redirectPath = getRedirectPath();
    // Only redirect to non-auth paths (avoid redirecting to /login or /register)
    const isSafePath =
      redirectPath && !redirectPath.startsWith('/login') && !redirectPath.startsWith('/register');

    // Clear the redirect path after we've decided to use it (avoid setState during render)
    useEffect(() => {
      if (isSafePath) {
        clearRedirect();
      }
    }, [isSafePath, clearRedirect]);

    if (isSafePath) {
      return <Navigate to={redirectPath} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
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
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
