import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import { useAuthStore, useAuthRedirect } from './stores/authStore';
import { useGamificationSSE } from './hooks/useGamificationSSE';
import { Spinner } from './components/ui/Spinner';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { LessonPage } from './pages/LessonPage';
import { MissionReportPage } from './pages/MissionReportPage';
import { ClassListPage } from './pages/ClassListPage';
import { ClassEditorPage } from './pages/ClassEditorPage';
import { ClassTemplatesPage } from './pages/ClassTemplatesPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { RecipesPage } from './pages/RecipesPage';
import { RecipeEditorPage } from './pages/RecipeEditorPage';

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
      <div className="flex items-center justify-center min-h-screen bg-[#f0f9ff]">
        <div className="text-center">
          <Spinner size="lg" className="text-sky-500" />
          <p className="mt-4 text-sky-800 font-bold">Verificando pase de explorador...</p>
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

  const isSafePath = Boolean(
    redirectPath && !redirectPath.startsWith('/login') && !redirectPath.startsWith('/register'),
  );

  useEffect(() => {
    if (isHydrated && !isValidating && isAuthenticated && isSafePath) {
      clearRedirect();
    }
  }, [isHydrated, isValidating, isAuthenticated, isSafePath, clearRedirect]);

  if (!isHydrated || isValidating) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f9ff]">
        <div className="text-center">
          <Spinner size="lg" className="text-sky-500" />
          <p className="mt-4 text-sky-800 font-bold">Cargando...</p>
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

function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, user } = useAuthStore();

  if (!isHydrated || !isAuthenticated) {
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
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
