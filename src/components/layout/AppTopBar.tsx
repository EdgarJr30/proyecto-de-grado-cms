import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, PanelTop, X } from 'lucide-react';
import { APP_ROUTES } from '../../Routes/appRoutes';
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
    <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-slate-200 bg-white/95 backdrop-blur md:left-60">
      <div className="mx-auto flex h-full items-center justify-between gap-3 px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSidebar}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={sidebarOpen ? 'Cerrar menú lateral' : 'Abrir menú lateral'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Navegación
            </p>
            <p className="truncate text-sm font-semibold text-slate-900 md:text-base">
              {title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 md:inline-flex md:items-center md:gap-1.5">
            <PanelTop className="h-3.5 w-3.5" />
            Barra superior
          </span>
          <UserQuickMenu />
        </div>
      </div>
    </header>
  );
}
