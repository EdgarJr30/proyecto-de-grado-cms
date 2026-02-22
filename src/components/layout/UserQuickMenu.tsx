import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  CircleUserRound,
  LogOut,
  PlusCircle,
  Settings,
} from 'lucide-react';
import { APP_ROUTES } from '../../Routes/appRoutes';
import { usePermissions } from '../../rbac/PermissionsContext';
import { useUser } from '../../context/UserContext';
import { signOut } from '../../utils/auth';

const PROFILE_PATH = '/mi-perfil';
const CREATE_TICKET_PATH = '/crear-ticket';
const SETTINGS_PATH = '/admin/settings';

function routePerms(path: string): string[] {
  return APP_ROUTES.find((route) => route.path === path)?.allowPerms ?? [];
}

const PROFILE_PERMS = routePerms(PROFILE_PATH);
const CREATE_TICKET_PERMS = routePerms(CREATE_TICKET_PATH);
const SETTINGS_PERMS = routePerms(SETTINGS_PATH);

export default function UserQuickMenu() {
  const navigate = useNavigate();
  const location_id = useLocation();
  const { profile } = useUser();
  const { has, roles } = usePermissions();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const canGoProfile = has(PROFILE_PERMS);
  const canCreateTicket = has(CREATE_TICKET_PERMS);
  const canGoSettings = has(SETTINGS_PERMS);

  const fullName = useMemo(() => {
    const merged = `${profile?.name ?? ''} ${profile?.last_name ?? ''}`.trim();
    return merged.length > 0 ? merged : 'Usuario';
  }, [profile?.last_name, profile?.name]);

  const initials = useMemo(() => {
    const chunks = fullName.split(/\s+/).filter(Boolean);
    if (chunks.length === 0) return 'U';
    const first = chunks[0]?.charAt(0) ?? 'U';
    const second = chunks[1]?.charAt(0) ?? '';
    return `${first}${second}`.toUpperCase();
  }, [fullName]);

  const primaryRole = roles[0] ?? 'Usuario';

  useEffect(() => {
    setOpen(false);
  }, [location_id.pathname, location_id.search]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const goTo = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Error al cerrar sesión:', error.message);
        return;
      }
      setOpen(false);
      navigate('/login', { replace: true });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="group flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-1.5 pr-2 shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
          {initials}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[150px] truncate text-left text-sm font-semibold text-slate-900">
            {fullName}
          </span>
          <span className="block max-w-[150px] truncate text-left text-[11px] text-slate-500">
            {primaryRole}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
        >
          {canGoProfile && (
            <button
              type="button"
              onClick={() => goTo(PROFILE_PATH)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              <CircleUserRound className="h-4 w-4" />
              Mi perfil
            </button>
          )}

          {canCreateTicket && (
            <button
              type="button"
              onClick={() => goTo(CREATE_TICKET_PATH)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              <PlusCircle className="h-4 w-4" />
              Crear ticket
            </button>
          )}

          {canGoSettings && (
            <button
              type="button"
              onClick={() => goTo(SETTINGS_PATH)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              <Settings className="h-4 w-4" />
              Configuración
            </button>
          )}

          <div className="my-2 border-t border-slate-200" />

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
