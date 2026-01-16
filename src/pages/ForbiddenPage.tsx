// src/pages/ForbiddenPage.tsx
import { useNavigate } from 'react-router-dom';
import AppVersion from '../components/ui/AppVersion';
import { signOut } from '../utils/auth';

export default function ForbiddenPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Error al cerrar sesión:', error.message);
        return;
      }
      navigate('/login', { replace: true });
    } catch (e: unknown) {
      if (e instanceof Error) console.error(e.message);
      else console.error(e);
    }
  };

  const goHome = () => {
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-4xl font-bold mb-3">403 · Acceso denegado</h1>
      <p className="text-muted-foreground max-w-xl">
        No tienes permisos para ver este recurso. Pide a un administrador que te
        asigne el rol adecuado o verifique tus permisos.
      </p>

      {/* Acciones */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={goHome}
          className="w-full px-4 py-3 rounded-md bg-gray-800 hover:bg-gray-700 text-white font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          Ir al inicio
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md border border-red-500 text-red-500 hover:bg-red-500/10 transition font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m-3-3h8.25m0 0-3-3m3 3-3 3"
            />
          </svg>
          Cerrar sesión
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-800 mt-10 w-full max-w-sm">
        © 2025 CILM
      </div>
      <AppVersion className="text-center mt-0 mb-2" />
    </div>
  );
}
