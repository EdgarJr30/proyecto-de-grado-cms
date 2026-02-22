import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DefaultSidebarLogo from '../../assets/logo.png';
import { signOut } from '../../utils/auth';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { APP_ROUTES } from '../../Routes/appRoutes';
import { usePermissions } from '../../rbac/PermissionsContext';
import { useBranding } from '../../context/BrandingContext';
import Footer from '../ui/Footer';
import { useLocationCatalog } from '../../hooks/useLocationCatalog';

export default function Sidebar() {
  const { loading } = useAuth();
  const { profile } = useUser();
  const { has, ready, roles } = usePermissions();
  const { logoSrc } = useBranding();
  const { getLocationLabel } = useLocationCatalog();

  const location_id = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpenSidebar = () => setIsOpen(true);
    const handleCloseSidebar = () => setIsOpen(false);
    window.addEventListener('app:sidebar-open', handleOpenSidebar);
    window.addEventListener('app:sidebar-close', handleCloseSidebar);
    return () => {
      window.removeEventListener('app:sidebar-open', handleOpenSidebar);
      window.removeEventListener('app:sidebar-close', handleCloseSidebar);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('app:sidebar-state', { detail: { open: isOpen } })
    );
  }, [isOpen]);

  // Si ya hay cache, esto viene instantáneo. Si no, caerá en default.
  const finalLogoSrc = logoSrc ?? DefaultSidebarLogo;

  // Menú por permisos (any-of)
  const visibleMenu = useMemo(
    () => APP_ROUTES.filter((r) => r.showInSidebar && has(r.allowPerms)),
    [has]
  );

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Error al cerrar sesión:', error.message);
        return;
      }
      navigate('/login', { replace: true });
    } catch (e) {
      console.error(e);
    }
  };

  const initials = profile?.name?.trim()?.charAt(0).toUpperCase() ?? 'U';
  const fullName = profile ? `${profile.name} ${profile.last_name}` : 'Usuario';
  const rolesString = roles.length ? roles.join(', ') : '—';
  const userLocationLabel =
    typeof profile?.location_id === 'number'
      ? getLocationLabel(profile.location_id)
      : null;

  // Mientras carga auth o permisos → skeleton
  if (loading || !ready) {
    return (
      <aside className="fixed top-0 left-0 w-60 bg-gray-900 text-gray-200 flex flex-col h-[100dvh]">
        <div className="h-16 px-4 border-b border-gray-700 flex items-center">
          <div className="h-7 w-32 rounded bg-gray-800 animate-pulse" />
        </div>
        <div className="p-4 space-y-2">
          <div className="h-9 rounded bg-gray-800 animate-pulse" />
          <div className="h-9 rounded bg-gray-800 animate-pulse" />
          <div className="h-9 rounded bg-gray-800 animate-pulse" />
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Overlay (móvil) */}
      <div
        className={`fixed inset-x-0 bottom-0 top-16 bg-black/40 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } md:hidden`}
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed top-16 left-0 w-60 bg-gray-900 text-gray-200 shadow-xl flex flex-col z-50
          transform transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          h-[calc(100dvh-4rem)] md:top-0 md:translate-x-0 md:static md:flex md:h-[100dvh] overflow-y-auto
        `}
      >
        {/* Logo */}
        <div className="h-16 px-4 border-b border-gray-700 flex items-center">
          {logoSrc ? (
            <img src={finalLogoSrc} alt="Logo" className="h-7 w-auto" />
          ) : (
            <div className="h-7 w-32 rounded bg-gray-800 animate-pulse" />
          )}
        </div>

        {/* Menú */}
        <nav className="flex flex-col gap-1 flex-1 px-2 py-3">
          {visibleMenu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`px-4 py-3 rounded transition font-medium flex items-center gap-2 ${
                location_id.pathname === item.path
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-800'
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          ))}
          {visibleMenu.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">
              No tienes menús disponibles.
            </div>
          )}
        </nav>

        {/* User card */}
        <div className="px-4 pt-4 pb-3 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-600 grid place-items-center font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {fullName}
              </p>
              <p className="text-xs text-gray-400 truncate">{rolesString}</p>
            </div>
          </div>
          {userLocationLabel && (
            <p className="mt-1 text-[11px] text-gray-400 truncate">
              {userLocationLabel}
            </p>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-gray-800 transition font-medium
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2
                     focus-visible:ring-offset-gray-900 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m-3-3h8.25m0 0-3-3m3 3-3 3"
            />
          </svg>
          Cerrar sesión
        </button>
        <Footer variant="dark" />
      </aside>
    </>
  );
}
