// src/components/Routes/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import AppTopBar from '../components/layout/AppTopBar';

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, isAuthenticated } = useAuth();
  const location_id = useLocation();

  // 🔇 Importante: NO hay listener de visibilitychange aquí.

  if (loading) {
    return (
      <div className="h-screen w-screen grid place-items-center">
        <Spinner />
      </div>
    );
  }

  return isAuthenticated ? (
    <>
      <AppTopBar />
      <div className="app-shell-safe">{children}</div>
    </>
  ) : (
    <Navigate to="/login" state={{ from: location_id }} replace />
  );
}
