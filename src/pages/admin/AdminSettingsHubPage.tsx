import { useEffect, useMemo, useState, type JSX } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import Navbar from '../../components/navigation/Navbar';
import { Can, useCan } from '../../rbac/PermissionsContext';
import { cn } from '../../utils/cn';
import {
  Settings,
  ShieldCheck,
  ListChecks,
  AlertTriangle,
  Megaphone,
} from 'lucide-react';
import GeneralSettings from '../../components/dashboard/admin/GeneralSettings';
import RoleList from '../../components/dashboard/roles/RoleList';
import PermissionsTable from '../../components/dashboard/permissions/PermissionsTable';
import RoleUsersModal from './RoleUsersModal';
import SpecialIncidentsTable from '../../components/dashboard/special-incidents/SpecialIncidentsTable';
import AnnouncementsTable from '../../components/dashboard/announcements/AnnouncementsTable';

type TabKey =
  | 'general'
  | 'roles'
  | 'permissions'
  | 'incidents'
  | 'announcements';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function TopTabs({
  value,
  onChange,
  disabledPermissionsTab,
  disabledRolesTab,
  disabledIncidentsTab,
  disabledAnnouncementsTab,
}: {
  value: TabKey;
  onChange: (t: TabKey) => void;
  disabledPermissionsTab?: boolean;
  disabledRolesTab?: boolean;
  disabledIncidentsTab?: boolean;
  disabledAnnouncementsTab?: boolean;
}) {
  const Item = ({
    k,
    icon,
    label,
    disabled,
    className,
  }: {
    k: TabKey;
    icon: JSX.Element;
    label: string;
    disabled?: boolean;
    className?: string;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(k)}
      className={cn(
        // ancho fluido para móvil; en pantallas ≥sm el ancho se ajusta al contenido
        'inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition cursor-pointer w-full sm:w-auto',
        value === k
          ? 'bg-indigo-600 text-white'
          : 'bg-white hover:bg-gray-50 border',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      title={disabled ? 'No tienes permiso' : undefined}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );

  return (
    <div className="rounded-2xl border bg-white p-2 shadow-sm">
      {/* contenedor flexible que envuelve; en móvil se apilan, y si hay espacio caben 2 por fila */}
      <div className="flex flex-wrap gap-2">
        <Item
          k="roles"
          label="Roles"
          icon={<ShieldCheck className="h-4 w-4" />}
          disabled={disabledRolesTab}
          className="sm:flex-none"
        />
        <Item
          k="permissions"
          label="Permisos"
          icon={<ListChecks className="h-4 w-4" />}
          disabled={disabledPermissionsTab}
          className="sm:flex-none"
        />
        <Item
          k="incidents"
          label="Incidencias"
          icon={<AlertTriangle className="h-4 w-4" />}
          disabled={disabledIncidentsTab}
          className="sm:flex-none"
        />
        {/* ⬇️ NUEVO: pestaña Anuncios */}
        <Item
          k="announcements"
          label="Anuncios"
          icon={<Megaphone className="h-4 w-4" />}
          disabled={disabledAnnouncementsTab}
          className="sm:flex-none"
        />
        <Item
          k="general"
          label="General"
          icon={<Settings className="h-4 w-4" />}
          className="sm:flex-none"
        />
      </div>
    </div>
  );
}

export default function AdminSettingsHubPage() {
  const q = useQuery();
  const navigate = useNavigate();

  const canSeePermissions = useCan('rbac:manage_permissions');
  const canManageRoles = useCan('rbac:manage_roles');

  const canIncidentsFull = useCan('special_incidents:full_access');
  const canIncidentsDisable = useCan('special_incidents:disable');
  const canIncidentsDelete = useCan('special_incidents:delete');
  const canManageIncidents =
    canIncidentsFull || canIncidentsDisable || canIncidentsDelete;

  // Permisos de anuncios
  const canAnnouncementsRead = useCan('announcements:read');
  const canAnnouncementsFull = useCan('announcements:full_access');
  const canAnnouncementsDisable = useCan('announcements:disable');
  const canAnnouncementsDelete = useCan('announcements:delete');
  const canManageAnnouncements =
    canAnnouncementsFull ||
    canAnnouncementsDisable ||
    canAnnouncementsDelete ||
    canAnnouncementsRead;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  const rawTab = q.get('tab') as TabKey | null;

  const computedInitial: TabKey =
    rawTab ||
    (canManageRoles
      ? 'roles'
      : canSeePermissions
      ? 'permissions'
      : canManageIncidents
      ? 'incidents'
      : canManageAnnouncements
      ? 'announcements'
      : 'general');

  const [tab, setTab] = useState<TabKey>(computedInitial);

  // Estado del modal “Usuarios por rol”
  const [roleUsersModal, setRoleUsersModal] = useState<{
    open: boolean;
    roleId?: number;
  }>({
    open: false,
  });

  // Redirecciones por permisos
  useEffect(() => {
    if (tab === 'roles' && !canManageRoles) {
      const next: TabKey = canSeePermissions
        ? 'permissions'
        : canManageIncidents
        ? 'incidents'
        : canManageAnnouncements
        ? 'announcements'
        : 'general';
      setTab(next);
      navigate(`/admin/settings?tab=${next}`, { replace: true });
    }
    if (tab === 'permissions' && !canSeePermissions) {
      const next: TabKey = canManageRoles
        ? 'roles'
        : canManageIncidents
        ? 'incidents'
        : canManageAnnouncements
        ? 'announcements'
        : 'general';
      setTab(next);
      navigate(`/admin/settings?tab=${next}`, { replace: true });
    }
    if (tab === 'incidents' && !canManageIncidents) {
      const next: TabKey = canManageRoles
        ? 'roles'
        : canSeePermissions
        ? 'permissions'
        : canManageAnnouncements
        ? 'announcements'
        : 'general';
      setTab(next);
      navigate(`/admin/settings?tab=${next}`, { replace: true });
    }
    if (tab === 'announcements' && !canManageAnnouncements) {
      const next: TabKey = canManageRoles
        ? 'roles'
        : canSeePermissions
        ? 'permissions'
        : canManageIncidents
        ? 'incidents'
        : 'general';
      setTab(next);
      navigate(`/admin/settings?tab=${next}`, { replace: true });
    }
  }, [
    tab,
    canManageRoles,
    canSeePermissions,
    canManageIncidents,
    canManageAnnouncements,
    navigate,
  ]);

  // Mantener tab en la URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', tab);
    navigate(`/admin/settings?${params.toString()}`, { replace: true });
  }, [tab, navigate]);

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <div className="w-full">
          <Navbar
            onSearch={setSearchTerm}
            onFilterLocation={setSelectedLocation}
            selectedLocation={selectedLocation}
          />
        </div>

        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Configuración</h1>
              <p className="text-sm text-gray-500">
                Administra parámetros de la plataforma, roles, permisos,
                incidencias y anuncios.
              </p>
            </div>

            <TopTabs
              value={tab}
              onChange={(t) => setTab(t)}
              disabledPermissionsTab={!canSeePermissions}
              disabledRolesTab={!canManageRoles}
              disabledIncidentsTab={!canManageIncidents}
              disabledAnnouncementsTab={!canManageAnnouncements}
            />
          </div>
        </header>

        <section className="flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-4 pb-8">
          {tab === 'roles' && (
            <Can perm="rbac:manage_roles">
              <div className="space-y-6">
                <RoleList
                  searchTerm={searchTerm}
                  onOpenUsers={(roleId: number) =>
                    setRoleUsersModal({ open: true, roleId })
                  }
                />
                <p className="text-xs text-gray-500">
                  Tip: usa el botón “Usuarios” para gestionar miembros del rol
                  sin salir de esta pantalla.
                </p>
              </div>
            </Can>
          )}

          {tab === 'permissions' && (
            <Can perm="rbac:manage_permissions">
              <PermissionsTable searchTerm={searchTerm} />
            </Can>
          )}

          {tab === 'incidents' && (
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Incidencias Especiales</h2>
              <p className="text-sm text-gray-500">
                Tipos configurables (p. ej. huracán, tormenta eléctrica) para
                marcar tickets.
              </p>
              <SpecialIncidentsTable searchTerm={searchTerm} />
            </div>
          )}

          {tab === 'announcements' && (
            <Can perm="announcements:read">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Anuncios</h2>
                <p className="text-sm text-gray-500">
                  Gestiona anuncios visibles para audiencias específicas por
                  rol.
                </p>
                <AnnouncementsTable searchTerm={searchTerm} />
              </div>
            </Can>
          )}

          {tab === 'general' && (
            <div className="max-w-3xl">
              <GeneralSettings />
            </div>
          )}
        </section>
      </main>

      {roleUsersModal.open && typeof roleUsersModal.roleId === 'number' && (
        <RoleUsersModal
          roleId={roleUsersModal.roleId}
          onClose={() => setRoleUsersModal({ open: false })}
        />
      )}
    </div>
  );
}
