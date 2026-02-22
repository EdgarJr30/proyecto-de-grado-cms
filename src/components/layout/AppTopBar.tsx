import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { APP_ROUTES } from '../../Routes/appRoutes';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils/cn';
import UserQuickMenu from './UserQuickMenu';

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
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const handleSidebarState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setSidebarOpen(Boolean(customEvent.detail?.open));
    };

    window.addEventListener('app:sidebar-state', handleSidebarState);
    return () => {
      window.removeEventListener('app:sidebar-state', handleSidebarState);
    };
  }, []);

  const title = useMemo(
    () => resolveTitle(location_id.pathname),
    [location_id.pathname]
  );

  const handleToggleSidebar = () => {
    window.dispatchEvent(
      new Event(sidebarOpen ? 'app:sidebar-close' : 'app:sidebar-open')
    );
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-slate-200 bg-white/95 backdrop-blur md:left-60 dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex h-full items-center justify-between gap-3 px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              Navegación
            </p>
            <p className="truncate text-sm font-semibold text-slate-900 md:text-base dark:text-slate-100">
              {title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
    </header>
  );
}
