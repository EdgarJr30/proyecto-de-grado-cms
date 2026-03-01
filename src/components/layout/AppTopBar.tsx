import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { APP_ROUTES } from '../../Routes/appRoutes';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils/cn';
import UserQuickMenu from './UserQuickMenu';
import { resolveTopBarMeta } from './topBarMeta';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'app:sidebar-desktop-collapsed:v1';

function getInitialDesktopCollapsedState() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesRoute(pathPattern: string, currentPath: string) {
  if (!pathPattern.includes(':')) return pathPattern === currentPath;

  const regexSource = pathPattern
    .split('/')
    .map((chunk) => (chunk.startsWith(':') ? '[^/]+' : escapeRegExp(chunk)))
    .join('/');

  return new RegExp(`^${regexSource}$`).test(currentPath);
}

function resolveTitle(pathname: string) {
  const route = APP_ROUTES.find((item) => matchesRoute(item.path, pathname));
  if (route?.name) return route.name;
  return 'Panel';
}

export default function AppTopBar() {
  const location_id = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(
    getInitialDesktopCollapsedState
  );
  const { isDark, toggleTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const handleSidebarState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setSidebarOpen(Boolean(customEvent.detail?.open));
    };

    const handleDesktopSidebarState = (event: Event) => {
      const customEvent = event as CustomEvent<{ collapsed?: boolean }>;
      setDesktopSidebarCollapsed(Boolean(customEvent.detail?.collapsed));
    };

    window.addEventListener('app:sidebar-state', handleSidebarState);
    window.addEventListener(
      'app:sidebar-desktop-state',
      handleDesktopSidebarState
    );
    return () => {
      window.removeEventListener('app:sidebar-state', handleSidebarState);
      window.removeEventListener(
        'app:sidebar-desktop-state',
        handleDesktopSidebarState
      );
    };
  }, []);

  const title = useMemo(
    () => resolveTitle(location_id.pathname),
    [location_id.pathname]
  );
  const topBarMeta = useMemo(
    () => resolveTopBarMeta(location_id.pathname, title),
    [location_id.pathname, title]
  );
  const breadcrumbOnlyHeader = Boolean(topBarMeta.breadcrumbs?.length);
  const hasDetailedHeader = breadcrumbOnlyHeader
    ? false
    : Boolean(topBarMeta.description || topBarMeta.breadcrumbs?.length);

  const handleToggleSidebar = () => {
    window.dispatchEvent(
      new Event(sidebarOpen ? 'app:sidebar-close' : 'app:sidebar-open')
    );
  };

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--app-topbar-height',
      hasDetailedHeader ? '6rem' : '4rem'
    );
  }, [hasDetailedHeader]);

  return (
    <motion.header
      initial={
        prefersReducedMotion
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: -8 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
      }
      className={`fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur transition-[left,height] duration-300 ${
        hasDetailedHeader ? 'h-24' : 'h-16'
      } ${
        desktopSidebarCollapsed ? 'md:left-20' : 'md:left-60'
      } dark:border-slate-700 dark:bg-slate-900/95`}
    >
      <div
        className={cn(
          'mx-auto flex h-full justify-between gap-3 px-3 md:px-6',
          hasDetailedHeader ? 'items-start py-3' : 'items-center'
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          <button
            type="button"
            onClick={handleToggleSidebar}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-label={sidebarOpen ? 'Cerrar menú lateral' : 'Abrir menú lateral'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="min-w-0">
            {topBarMeta.breadcrumbs?.length ? (
              <nav
                className={cn(
                  'flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-slate-500 dark:text-slate-400',
                  hasDetailedHeader ? 'mt-0.5' : ''
                )}
              >
                {topBarMeta.breadcrumbs.map((breadcrumb, index) => {
                  const isLast = index === topBarMeta.breadcrumbs!.length - 1;
                  return (
                    <div key={`${breadcrumb.label}-${index}`} className="flex items-center gap-1.5">
                      {breadcrumb.to && !isLast ? (
                        <Link
                          to={breadcrumb.to}
                          className="truncate hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          {breadcrumb.label}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            'truncate',
                            isLast
                              ? 'font-semibold text-slate-900 dark:text-slate-100'
                              : ''
                          )}
                        >
                          {breadcrumb.label}
                        </span>
                      )}
                      {!isLast ? <span className="text-slate-400">›</span> : null}
                    </div>
                  );
                })}
              </nav>
            ) : null}
            {breadcrumbOnlyHeader && topBarMeta.description ? (
              <p className="max-w-[32rem] truncate text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                {topBarMeta.description}
              </p>
            ) : null}
            {!breadcrumbOnlyHeader ? (
              <p className="truncate text-sm font-semibold text-slate-900 md:text-base dark:text-slate-100">
                {topBarMeta.title}
              </p>
            ) : null}
            {!breadcrumbOnlyHeader && topBarMeta.description ? (
              <p className="max-w-3xl truncate text-xs text-slate-500 dark:text-slate-400">
                {topBarMeta.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {topBarMeta.badges?.map((badge) => (
            <span
              key={badge}
              className="hidden sm:inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
            >
              {badge}
            </span>
          ))}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              isDark
                ? 'Desactivar modo oscuro'
                : 'Activar modo oscuro'
            }
            role="switch"
            aria-checked={isDark}
            className="group relative inline-flex h-10 w-[84px] items-center rounded-full border border-slate-300/90 bg-white/80 p-1 shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900/80"
          >
            <span
              className={cn(
                'pointer-events-none absolute inset-1 rounded-full transition-all duration-300',
                isDark
                  ? 'bg-gradient-to-r from-slate-800 via-indigo-900 to-slate-800'
                  : 'bg-gradient-to-r from-sky-100 via-slate-50 to-amber-100'
              )}
            />
            <span className="pointer-events-none absolute left-3 right-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em]">
              <span
                className={cn(
                  'transition-colors duration-300',
                  isDark ? 'text-slate-500' : 'text-slate-700'
                )}
              >
                Off
              </span>
              <span
                className={cn(
                  'transition-colors duration-300',
                  isDark ? 'text-emerald-200' : 'text-slate-400'
                )}
              >
                On
              </span>
            </span>
            <span
              className={cn(
                'relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full shadow-md ring-1 ring-slate-900/10 transition-all duration-300 ease-out',
                isDark
                  ? 'translate-x-[44px] bg-slate-100 text-indigo-700'
                  : 'translate-x-0 bg-white text-amber-500'
              )}
            >
              {isDark ? (
                <Moon className="h-4 w-4 transition-transform duration-500 group-active:scale-90" />
              ) : (
                <Sun className="h-4 w-4 transition-transform duration-500 group-active:scale-90" />
              )}
            </span>
          </button>
          <UserQuickMenu />
        </div>
      </div>
    </motion.header>
  );
}
