// src/components/Routes/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import Spinner from '../ui/Spinner';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // 🔇 Importante: NO hay listener de visibilitychange aquí.

  if (loading) {
    return (
      <div className="h-screen w-screen grid place-items-center">
        <Spinner />
      </div>
    );
  }

  return isAuthenticated ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" state={{ from: location }} replace />
  );
}
