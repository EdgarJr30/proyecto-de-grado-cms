import { useEffect, useMemo, useState, type JSX } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { Can, useCan } from '../../rbac/PermissionsContext';
import { cn } from '../../utils/cn';
import {
  Settings,
  ShieldCheck,
  ListChecks,
  AlertTriangle,
  Megaphone,
} from 'lucide-react';
import GeneralSettings from '../../components/dashboard/admin/settings/GeneralSettings';
import RoleList from '../../components/dashboard/roles/RoleList';
import PermissionsTable from '../../components/dashboard/permissions/PermissionsTable';
import RoleUsersModal from './RoleUsersModal';
import SpecialIncidentsTable from '../../components/dashboard/special-incidents/SpecialIncidentsTable';
import AnnouncementsTable from '../../components/dashboard/admin/announcements/AnnouncementsTable';
import SocietySettingsTable from '../../components/dashboard/society/SocietySettingsDetail';
import AssetsBoard from '../../components/dashboard/admin/assets/AssetsBoard';

type TabKey =
  | 'general'
  | 'roles'
  | 'permissions'
  | 'incidents'
  | 'announcements'
  | 'sociedad'
  | 'assets';

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
  disabledSocietyTab,
  disabledAssetsTab,
}: {
  value: TabKey;
  onChange: (t: TabKey) => void;
  disabledPermissionsTab?: boolean;
  disabledRolesTab?: boolean;
  disabledIncidentsTab?: boolean;
  disabledAnnouncementsTab?: boolean;
  disabledSocietyTab?: boolean;
  disabledAssetsTab?: boolean;
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
        <Item
          k="announcements"
          label="Anuncios"
          icon={<Megaphone className="h-4 w-4" />}
          disabled={disabledAnnouncementsTab}
          className="sm:flex-none"
        />
        <Item
          k="sociedad"
          label="Sociedad"
          icon={<Settings className="h-4 w-4" />}
          disabled={disabledSocietyTab}
          className="sm:flex-none"
        />
        <Item
          k="assets"
          label="Activos"
          icon={<Settings className="h-4 w-4" />}
          disabled={disabledAssetsTab}
          className="sm:flex-none"
        />
        {/* ✅ General: NO se bloquea aquí; adentro GeneralSettings decide qué mostrar */}
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

  const canAnnouncementsRead = useCan('announcements:read');
  const canAnnouncementsFull = useCan('announcements:full_access');
  const canAnnouncementsDisable = useCan('announcements:disable');
  const canAnnouncementsDelete = useCan('announcements:delete');
  const canManageAnnouncements =
    canAnnouncementsFull ||
    canAnnouncementsDisable ||
    canAnnouncementsDelete ||
    canAnnouncementsRead;

  const canSocietyRead = useCan('society:read');
  const canSocietyFull = useCan('society:full_access');
  const canSocietyDisable = useCan('society:disable');
  const canSocietyDelete = useCan('society:delete');
  const canManageSociety =
    canSocietyFull || canSocietyDisable || canSocietyDelete || canSocietyRead;

  const canAssetsRead = useCan('assets:read');
  const canAssetsFull = useCan('assets:full_access');
  const canAssetsDisable = useCan('assets:disable');
  const canAssetsDelete = useCan('assets:delete');
  const canManageAssets =
    canAssetsFull || canAssetsDisable || canAssetsDelete || canAssetsRead;

  const [searchTerm] = useState('');

  const rawTab = q.get('tab') as TabKey | null;

  // ✅ Tab inicial: prioriza lo “admin”; si no, cae en general
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
            : canManageSociety
              ? 'sociedad'
              : canManageAssets
                ? 'assets'
                : 'general');

  const [tab, setTab] = useState<TabKey>(computedInitial);

  const [roleUsersModal, setRoleUsersModal] = useState<{
    open: boolean;
    roleId?: number;
  }>({ open: false });

  // ✅ Si el tab pedido no está permitido (excepto general), cae al primero permitido o general.
  const pickFirstAllowedTab = (): TabKey => {
    if (canManageRoles) return 'roles';
    if (canSeePermissions) return 'permissions';
    if (canManageIncidents) return 'incidents';
    if (canManageAnnouncements) return 'announcements';
    if (canManageSociety) return 'sociedad';
    if (canManageAssets) return 'assets';
    return 'general';
  };

  useEffect(() => {
    if (tab === 'roles' && !canManageRoles) {
      const next = pickFirstAllowedTab();
      setTab(next);
      navigate(`/admin/settings?tab=${next}`, { replace: true });
      return;
    }

    if (tab === 'permissions' && !canSeePermissions) {
      const next = pickFirstAllowedTab();
      setTab(next);
      navigate(`/admin/settings?tab=${next}`, { replace: true });
      return;
    }

    if (tab === 'incidents' && !canManageIncidents) {
      const next = pickFirstAllowedTab();
      setTab(next);
      navigate(`/admin/settings?tab=${next}`, { replace: true });
      return;
    }

    if (tab === 'announcements' && !canManageAnnouncements) {
      const next = pickFirstAllowedTab();
      setTab(next);
      navigate(`/admin/settings?tab=${next}`, { replace: true });
      return;
    }

    if (tab === 'sociedad' && !canManageSociety) {
      const next = pickFirstAllowedTab();
      setTab(next);
      navigate(`/admin/settings?tab=${next}`, { replace: true });
      return;
    }

    if (tab === 'assets' && !canAssetsFull) {
      const next = pickFirstAllowedTab();
      setTab(next);
      navigate(`/admin/settings?tab=${next}`, { replace: true });
      return;
    }

    // ✅ NO redirigimos "general": adentro se muestra lo que corresponda.
  }, [
    tab,
    canManageRoles,
    canSeePermissions,
    canManageIncidents,
    canManageAnnouncements,
    canManageSociety,
    canAssetsFull,
    navigate,
  ]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', tab);
    navigate(`/admin/settings?${params.toString()}`, { replace: true });
  }, [tab, navigate]);

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Configuración</h1>
              <p className="text-sm text-gray-500">
                Administra parámetros de la plataforma, roles, permisos,
                incidencias, anuncios y sociedad.
              </p>
            </div>

            <TopTabs
              value={tab}
              onChange={(t) => setTab(t)}
              disabledPermissionsTab={!canSeePermissions}
              disabledRolesTab={!canManageRoles}
              disabledIncidentsTab={!canManageIncidents}
              disabledAnnouncementsTab={!canManageAnnouncements}
              disabledSocietyTab={!canManageSociety}
              disabledAssetsTab={!canAssetsFull}
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

          {tab === 'sociedad' && (
            <Can perm="society:read">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Sociedad</h2>
                <p className="text-sm text-gray-500">
                  Parametriza los datos de cada empresa: nombre, logo, colores y
                  branding general.
                </p>
                <SocietySettingsTable />
              </div>
            </Can>
          )}

          {tab === 'assets' && (
            <Can perm="assets:full_access">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Activos</h2>
                <p className="text-sm text-gray-500">
                  Gestiona los activos de la plataforma.
                </p>
                <AssetsBoard />
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
