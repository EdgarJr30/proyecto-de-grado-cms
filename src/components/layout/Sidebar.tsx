import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { MotionPulse } from '../ui/motionPrimitives';
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
const SWIPE_OPEN_THRESHOLD_PX = 64;
const SWIPE_OPEN_VELOCITY = 550;

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

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
}

function isMenuRouteActive(itemPath: string, currentPath: string) {
  const normalizedItemPath = normalizePath(itemPath);
  const normalizedCurrentPath = normalizePath(currentPath);

  if (normalizedItemPath === '/inventario') {
    return (
      normalizedCurrentPath === '/inventario' ||
      normalizedCurrentPath.startsWith('/inventory/')
    );
  }

  return (
    normalizedCurrentPath === normalizedItemPath ||
    normalizedCurrentPath.startsWith(`${normalizedItemPath}/`)
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
  const [isSwipingFromEdge, setIsSwipingFromEdge] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mobileMediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewportState = () => setIsMobileViewport(mobileMediaQuery.matches);

    updateViewportState();
    mobileMediaQuery.addEventListener('change', updateViewportState);

    return () => {
      mobileMediaQuery.removeEventListener('change', updateViewportState);
    };
  }, []);

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

  const handleEdgeSwipeEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const travelledDistance = Math.max(0, info.offset.x);
    const travelledVelocity = info.velocity.x;

    if (
      travelledDistance >= SWIPE_OPEN_THRESHOLD_PX ||
      travelledVelocity >= SWIPE_OPEN_VELOCITY
    ) {
      setIsOpen(true);
    }

    setIsSwipingFromEdge(false);
  };

  const handleSidebarSwipeEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const travelledDistance = Math.min(0, info.offset.x);
    const travelledVelocity = info.velocity.x;

    if (
      travelledDistance <= -SWIPE_OPEN_THRESHOLD_PX ||
      travelledVelocity <= -SWIPE_OPEN_VELOCITY
    ) {
      setIsOpen(false);
    }
  };

  const handleOverlaySwipeEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const travelledDistance = Math.min(0, info.offset.x);
    const travelledVelocity = info.velocity.x;

    if (
      travelledDistance <= -SWIPE_OPEN_THRESHOLD_PX ||
      travelledVelocity <= -SWIPE_OPEN_VELOCITY
    ) {
      setIsOpen(false);
    }
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
          <MotionPulse className="h-7 w-32 rounded bg-gray-800" />
        </div>
        <div className="p-4 space-y-2">
          <MotionPulse className="h-9 rounded bg-gray-800" />
          <MotionPulse className="h-9 rounded bg-gray-800" />
          <MotionPulse className="h-9 rounded bg-gray-800" />
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Overlay (móvil) */}
      <motion.div
        className={`fixed inset-x-0 bottom-0 top-[var(--app-topbar-height)] bg-black/40 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } md:hidden`}
        onClick={() => setIsOpen(false)}
        drag={isMobileViewport && isOpen ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        dragSnapToOrigin
        onDragEnd={handleOverlaySwipeEnd}
      />

      {/* Zona de swipe desde el borde izquierdo (móvil) */}
      <motion.div
        aria-hidden
        className={`fixed left-0 top-[var(--app-topbar-height)] z-[45] h-[calc(100dvh-var(--app-topbar-height))] w-5 touch-pan-y md:hidden ${
          isOpen ? 'pointer-events-none' : ''
        }`}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 120 }}
        dragElastic={0.08}
        dragSnapToOrigin
        onDragStart={() => setIsSwipingFromEdge(true)}
        onDragEnd={handleEdgeSwipeEnd}
      >
        <motion.div
          className="absolute left-0 top-1/2 h-24 w-1.5 -translate-y-1/2 rounded-r-full bg-blue-400/35"
          animate={{
            opacity: isSwipingFromEdge ? 0.8 : 0.35,
            scaleY: isSwipingFromEdge ? 1.08 : 1,
          }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        />
      </motion.div>

      {/* Sidebar */}
      <motion.aside
        style={{ fontFamily: SIDEBAR_FONT_FAMILY }}
        className={`
          fixed top-[var(--app-topbar-height)] left-0 w-60 bg-gray-900 text-gray-200 shadow-xl flex flex-col z-50
          transform transition-[transform,width] duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          h-[calc(100dvh-var(--app-topbar-height))] md:top-0 md:translate-x-0 md:static md:flex md:h-[100dvh]
          ${isDesktopCollapsed ? 'md:w-20' : 'md:w-60'}
        `}
        drag={isMobileViewport && isOpen ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        dragSnapToOrigin
        onDragEnd={handleSidebarSwipeEnd}
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
            <MotionPulse className="h-7 w-32 rounded bg-gray-800" />
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
          {visibleMenu.map((item) => {
            const isActive = isMenuRouteActive(item.path, location_id.pathname);

            return (
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
                            isActive
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
            );
          })}
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
      </motion.aside>
    </>
  );
}

export default function Sidebar({ persistent = false }: SidebarProps) {
  const hasPersistentSidebar = useHasPersistentSidebar();

  if (hasPersistentSidebar && !persistent) return null;

  return <SidebarContent />;
}
