import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import DefaultSidebarLogo from '../../assets/logo.png';
import { signOut } from '../../utils/auth';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { APP_ROUTES } from '../../Routes/appRoutes';
import { usePermissions } from '../../rbac/PermissionsContext';
import { useBranding } from '../../context/BrandingContext';
import Footer from '../ui/Footer';
import { useHasPersistentSidebar } from './SidebarLayoutContext';

const SIDEBAR_FONT_FAMILY =
  "'Manrope', 'Nunito Sans', 'Segoe UI', sans-serif";
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'app:sidebar-desktop-collapsed:v1';

function getInitialDesktopCollapsedState() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
}

function CollapseToggleIcon({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.8"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 5.25h15M4.5 12h10.5M4.5 18.75h15M16.5 9l3 3-3 3"
      />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.8"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 5.25h15M9 12h10.5M4.5 18.75h15M7.5 9l-3 3 3 3"
      />
    </svg>
  );
}

type SidebarProps = {
  persistent?: boolean;
};

function SidebarContent() {
  const { loading } = useAuth();
  const { profile } = useUser();
  const { has, ready } = usePermissions();
  const { logoSrc } = useBranding();

  const location_id = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(
    getInitialDesktopCollapsedState
  );
  const prefersReducedMotion = useReducedMotion();

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

  useEffect(() => {
    localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      isDesktopCollapsed ? '1' : '0'
    );

    window.dispatchEvent(
      new CustomEvent('app:sidebar-desktop-state', {
        detail: { collapsed: isDesktopCollapsed },
      })
    );
  }, [isDesktopCollapsed]);

  useEffect(() => {
    setIsOpen(false);
  }, [location_id.pathname]);

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

  const fullName = profile ? `${profile.name} ${profile.last_name}` : 'Usuario';
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0))
    .join('')
    .toUpperCase() || 'U';

  const menuContainerVariants = {
    hidden: {},
    visible: prefersReducedMotion
      ? {}
      : {
          transition: {
            staggerChildren: 0.025,
            delayChildren: 0.03,
          },
        },
  };

  const menuItemVariants = {
    hidden: prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 },
    visible: { opacity: 1, x: 0 },
  };

  // Mientras carga auth o permisos → skeleton
  if (loading || !ready) {
    return (
      <aside
        style={{ fontFamily: SIDEBAR_FONT_FAMILY }}
        className={`fixed top-0 left-0 w-60 bg-gray-900 text-gray-200 flex flex-col h-[100dvh] transition-[width] duration-300 ${
          isDesktopCollapsed ? 'md:w-20' : 'md:w-60'
        }`}
      >
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
        style={{ fontFamily: SIDEBAR_FONT_FAMILY }}
        className={`
          fixed top-16 left-0 w-60 bg-gray-900 text-gray-200 shadow-xl flex flex-col z-50
          transform transition-[transform,width] duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          h-[calc(100dvh-4rem)] md:top-0 md:translate-x-0 md:static md:flex md:h-[100dvh]
          ${isDesktopCollapsed ? 'md:w-20' : 'md:w-60'}
        `}
      >
        {/* Header + logo */}
        <div
          className={`h-16 border-b border-gray-700 flex items-center gap-2 ${
            isDesktopCollapsed ? 'px-2 md:justify-center' : 'px-4 md:justify-between'
          }`}
        >
          {logoSrc ? (
            <img
              src={finalLogoSrc}
              alt="Logo"
              className={isDesktopCollapsed ? 'h-8 w-8 object-contain' : 'h-7 w-auto'}
            />
          ) : (
            <div className="h-7 w-32 rounded bg-gray-800 animate-pulse" />
          )}

          <button
            type="button"
            onClick={() => setIsDesktopCollapsed((prev) => !prev)}
            className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 bg-gray-800/70 text-gray-200 hover:bg-gray-700 transition"
            aria-label={
              isDesktopCollapsed ? 'Expandir menú lateral' : 'Minimizar menú lateral'
            }
            title={isDesktopCollapsed ? 'Expandir menú' : 'Minimizar menú'}
          >
            <CollapseToggleIcon collapsed={isDesktopCollapsed} />
          </button>
        </div>

        {/* Menú */}
        <motion.nav
          className={`flex flex-col gap-1 flex-1 py-3 ${
            isDesktopCollapsed ? 'px-1.5' : 'px-2'
          }`}
          variants={menuContainerVariants}
          initial={prefersReducedMotion ? false : 'hidden'}
          animate={prefersReducedMotion ? undefined : 'visible'}
        >
          {visibleMenu.map((item) => (
            <motion.div key={item.path} variants={menuItemVariants}>
              <Link
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`group relative flex items-center rounded-md transition text-sm font-medium leading-5
                          [&_svg]:h-5 [&_svg]:w-5 [&_svg]:mr-0 [&_svg]:shrink-0
                          ${
                            isDesktopCollapsed
                              ? 'gap-2 px-3 py-2 md:justify-center md:px-2 md:py-3'
                              : 'gap-2 px-3 py-2'
                          }
                          ${
                            location_id.pathname === item.path
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-gray-800'
                          }`}
              >
                {item.icon}
                <span className={isDesktopCollapsed ? 'md:hidden' : ''}>
                  {item.name}
                </span>

                {isDesktopCollapsed ? (
                  <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 md:block md:group-hover:opacity-100">
                    {item.name}
                  </span>
                ) : null}
              </Link>
            </motion.div>
          ))}
          {visibleMenu.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">
              No tienes menús disponibles.
            </div>
          )}
        </motion.nav>

        {/* User card */}
        <div
          className={`pt-1.5 pb-1.5 border-t border-gray-800 ${
            isDesktopCollapsed ? 'px-1.5' : 'px-2.5'
          }`}
        >
          <div
            className={`group relative flex items-center ${
              isDesktopCollapsed ? 'md:justify-center' : 'gap-1.5'
            }`}
          >
            <div className="h-7 w-7 rounded-full bg-blue-600 grid place-items-center text-[10px] font-semibold">
              {initials}
            </div>
            <div className={`min-w-0 ${isDesktopCollapsed ? 'md:hidden' : ''}`}>
              <p className="text-[11px] font-medium text-white truncate">
                {fullName}
              </p>
            </div>

            {isDesktopCollapsed ? (
              <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 md:block md:group-hover:opacity-100">
                {fullName}
              </span>
            ) : null}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`group relative w-full flex items-center px-2.5 py-1.5 text-xs text-red-500 hover:bg-gray-800 transition font-medium
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2
                     focus-visible:ring-offset-gray-900 cursor-pointer ${
                       isDesktopCollapsed ? 'md:justify-center md:px-2' : 'gap-1.5'
                     }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3.5 h-3.5"
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
          <span className={isDesktopCollapsed ? 'md:hidden' : ''}>
            Cerrar sesión
          </span>

          {isDesktopCollapsed ? (
            <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 md:block md:group-hover:opacity-100">
              Cerrar sesión
            </span>
          ) : null}
        </button>

        <Footer
          variant="dark"
          compact
          className={isDesktopCollapsed ? 'md:hidden' : ''}
        />
      </aside>
    </>
  );
}

export default function Sidebar({ persistent = false }: SidebarProps) {
  const hasPersistentSidebar = useHasPersistentSidebar();

  if (hasPersistentSidebar && !persistent) return null;

  return <SidebarContent />;
}
