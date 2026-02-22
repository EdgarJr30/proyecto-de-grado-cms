import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  KeyRound,
  Megaphone,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Sidebar from '../../components/layout/Sidebar';
import { Can, useCan } from '../../rbac/PermissionsContext';
import { cn } from '../../utils/cn';
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

type ModuleTone = {
  iconBg: string;
  iconColor: string;
  selectedBg: string;
  selectedBorder: string;
  focusRing: string;
};

type SettingsModule = {
  key: TabKey;
  label: string;
  description: string;
  helper: string;
  icon: LucideIcon;
  enabled: boolean;
  tone: ModuleTone;
};

const TAB_ORDER: TabKey[] = [
  'roles',
  'permissions',
  'incidents',
  'announcements',
  'sociedad',
  'assets',
  'general',
];

const SEARCHABLE_TABS = new Set<TabKey>([
  'roles',
  'permissions',
  'incidents',
  'announcements',
]);

const TAB_TONES: Record<TabKey, ModuleTone> = {
  roles: {
    iconBg: 'bg-indigo-100 dark:bg-indigo-500/15',
    iconColor: 'text-indigo-700 dark:text-indigo-300',
    selectedBg: 'bg-indigo-50 dark:bg-indigo-500/15',
    selectedBorder: 'border-indigo-200 dark:border-indigo-400/30',
    focusRing: 'focus-visible:ring-indigo-500',
  },
  permissions: {
    iconBg: 'bg-cyan-100 dark:bg-cyan-500/15',
    iconColor: 'text-cyan-700 dark:text-cyan-300',
    selectedBg: 'bg-cyan-50 dark:bg-cyan-500/15',
    selectedBorder: 'border-cyan-200 dark:border-cyan-400/30',
    focusRing: 'focus-visible:ring-cyan-500',
  },
  incidents: {
    iconBg: 'bg-amber-100 dark:bg-amber-500/15',
    iconColor: 'text-amber-700 dark:text-amber-300',
    selectedBg: 'bg-amber-50 dark:bg-amber-500/15',
    selectedBorder: 'border-amber-200 dark:border-amber-400/30',
    focusRing: 'focus-visible:ring-amber-500',
  },
  announcements: {
    iconBg: 'bg-rose-100 dark:bg-rose-500/15',
    iconColor: 'text-rose-700 dark:text-rose-300',
    selectedBg: 'bg-rose-50 dark:bg-rose-500/15',
    selectedBorder: 'border-rose-200 dark:border-rose-400/30',
    focusRing: 'focus-visible:ring-rose-500',
  },
  sociedad: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/15',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
    selectedBg: 'bg-emerald-50 dark:bg-emerald-500/15',
    selectedBorder: 'border-emerald-200 dark:border-emerald-400/30',
    focusRing: 'focus-visible:ring-emerald-500',
  },
  assets: {
    iconBg: 'bg-slate-200 dark:bg-slate-700',
    iconColor: 'text-slate-700 dark:text-slate-200',
    selectedBg: 'bg-slate-100 dark:bg-slate-700/60',
    selectedBorder: 'border-slate-300 dark:border-slate-500',
    focusRing: 'focus-visible:ring-slate-500',
  },
  general: {
    iconBg: 'bg-blue-100 dark:bg-blue-500/15',
    iconColor: 'text-blue-700 dark:text-blue-300',
    selectedBg: 'bg-blue-50 dark:bg-blue-500/15',
    selectedBorder: 'border-blue-200 dark:border-blue-400/30',
    focusRing: 'focus-visible:ring-blue-500',
  },
};

const SEARCH_PLACEHOLDERS: Partial<Record<TabKey, string>> = {
  roles: 'Buscar por nombre o descripción del rol',
  permissions: 'Buscar por código, label o descripción del permiso',
  incidents: 'Buscar incidencia especial por nombre o código',
  announcements: 'Buscar anuncios por mensaje o contenido',
};

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function isTabKey(value: string | null): value is TabKey {
  if (!value) return false;
  return TAB_ORDER.includes(value as TabKey);
}

function SettingsModuleNav({
  modules,
  value,
  onChange,
}: {
  modules: SettingsModule[];
  value: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabledIndices = useMemo(
    () => modules.flatMap((module, index) => (module.enabled ? [index] : [])),
    [modules]
  );

  const handleKeyboard = (event: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (enabledIndices.length === 0) return;

    const currentPos = enabledIndices.indexOf(idx);
    if (currentPos === -1) return;

    let nextPos = currentPos;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextPos = (currentPos + 1) % enabledIndices.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        nextPos = (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
        break;
      case 'Home':
        nextPos = 0;
        break;
      case 'End':
        nextPos = enabledIndices.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextIndex = enabledIndices[nextPos];
    const nextModule = modules[nextIndex];
    if (!nextModule || !nextModule.enabled) return;

    refs.current[nextIndex]?.focus();
    onChange(nextModule.key);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
          Submódulos
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          Navega por secciones con foco claro y permisos visibles.
        </p>
      </div>

      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Submódulos de configuración"
        className="space-y-2 p-2"
      >
        {modules.map((module, idx) => {
          const Icon = module.icon;
          const selected = value === module.key;

          return (
            <button
              key={module.key}
              ref={(el) => {
                refs.current[idx] = el;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${module.key}`}
              aria-controls={`settings-panel-${module.key}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              disabled={!module.enabled}
              onClick={() => onChange(module.key)}
              onKeyDown={(event) => handleKeyboard(event, idx)}
              className={cn(
                'w-full rounded-xl border px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2',
                module.tone.focusRing,
                selected
                  ? `${module.tone.selectedBg} ${module.tone.selectedBorder}`
                  : 'border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/70',
                !module.enabled &&
                  'cursor-not-allowed border-gray-200 bg-gray-100 opacity-70 dark:border-slate-700 dark:bg-slate-800'
              )}
              title={module.enabled ? module.description : 'Sin permisos'}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    module.tone.iconBg,
                    module.tone.iconColor
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {module.label}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
                    {module.helper}
                  </span>
                  <span
                    className={cn(
                      'mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      module.enabled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                    )}
                  >
                    {module.enabled ? 'Disponible' : 'Sin acceso'}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
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

  const canAssetsFull = useCan('assets:full_access');

  const modules = useMemo<SettingsModule[]>(
    () => [
      {
        key: 'roles',
        label: 'Roles',
        description: 'Gestiona los roles y su asignación de permisos.',
        helper: 'Estructura de acceso por perfil',
        icon: ShieldCheck,
        enabled: canManageRoles,
        tone: TAB_TONES.roles,
      },
      {
        key: 'permissions',
        label: 'Permisos',
        description: 'Administra códigos, descripciones y sincronización de permisos.',
        helper: 'Catálogo central de permisos',
        icon: KeyRound,
        enabled: canSeePermissions,
        tone: TAB_TONES.permissions,
      },
      {
        key: 'incidents',
        label: 'Incidencias',
        description: 'Mantén incidencias especiales para clasificación operativa.',
        helper: 'Tipos especiales para tickets',
        icon: AlertTriangle,
        enabled: canManageIncidents,
        tone: TAB_TONES.incidents,
      },
      {
        key: 'announcements',
        label: 'Anuncios',
        description: 'Publica avisos por rol y controla vigencia/visibilidad.',
        helper: 'Comunicaciones internas',
        icon: Megaphone,
        enabled: canManageAnnouncements,
        tone: TAB_TONES.announcements,
      },
      {
        key: 'sociedad',
        label: 'Sociedad',
        description: 'Configura nombre, branding e identidad institucional.',
        helper: 'Datos de organización y marca',
        icon: Building2,
        enabled: canManageSociety,
        tone: TAB_TONES.sociedad,
      },
      {
        key: 'assets',
        label: 'Activos',
        description: 'Administra activos físicos y su estado operativo.',
        helper: 'Inventario de activos',
        icon: Wrench,
        enabled: canAssetsFull,
        tone: TAB_TONES.assets,
      },
      {
        key: 'general',
        label: 'General',
        description: 'Ajustes transversales del sistema y catálogos base.',
        helper: 'Parámetros globales',
        icon: Settings,
        enabled: true,
        tone: TAB_TONES.general,
      },
    ],
    [
      canManageRoles,
      canSeePermissions,
      canManageIncidents,
      canManageAnnouncements,
      canManageSociety,
      canAssetsFull,
    ]
  );

  const moduleMap = useMemo(
    () =>
      new Map<TabKey, SettingsModule>(modules.map((module) => [module.key, module])),
    [modules]
  );

  const pickFirstAllowedTab = useMemo(
    () => () => {
      for (const key of TAB_ORDER) {
        const module = moduleMap.get(key);
        if (module?.enabled) return key;
      }
      return 'general' as TabKey;
    },
    [moduleMap]
  );

  const rawTab = q.get('tab');
  const initialTab = useMemo<TabKey>(() => {
    if (isTabKey(rawTab) && moduleMap.get(rawTab)?.enabled) return rawTab;
    return pickFirstAllowedTab();
  }, [rawTab, moduleMap, pickFirstAllowedTab]);

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleUsersModal, setRoleUsersModal] = useState<{
    open: boolean;
    roleId?: number;
  }>({ open: false });

  const activeModule = moduleMap.get(tab) ?? moduleMap.get('general') ?? modules[0];
  const searchable = SEARCHABLE_TABS.has(tab);
  const searchPlaceholder =
    SEARCH_PLACEHOLDERS[tab] ?? 'Buscar elementos del submódulo';
  const enabledCount = modules.filter((module) => module.enabled).length;

  useEffect(() => {
    if (!moduleMap.get(tab)?.enabled) {
      const next = pickFirstAllowedTab();
      setTab(next);
      navigate(`/admin/settings?tab=${next}`, { replace: true });
    }
  }, [tab, moduleMap, pickFirstAllowedTab, navigate]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', tab);
    navigate(`/admin/settings?${params.toString()}`, { replace: true });
  }, [tab, navigate]);

  useEffect(() => {
    setSearchTerm('');
  }, [tab]);

  const ActiveIcon = activeModule.icon;

  return (
    <div className="h-screen flex bg-[#f4f6fb] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />

      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 min-w-0">
        <header className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-0">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  Centro de configuración
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">
                  Configuración
                </h1>
                <p className="mt-1 text-sm text-slate-600 max-w-3xl dark:text-slate-300">
                  Organiza roles, permisos, incidencias, anuncios, datos de
                  sociedad y parámetros globales desde una sola vista.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-slate-500 dark:text-slate-400">Submódulos</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {modules.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-slate-500 dark:text-slate-400">Disponibles</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {enabledCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 col-span-2 sm:col-span-1 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-slate-500 dark:text-slate-400">Módulo activo</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 truncate dark:text-slate-100">
                    {activeModule.label}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 pt-4 pb-8">
          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-4 self-start">
              <SettingsModuleNav
                modules={modules}
                value={tab}
                onChange={(next) => setTab(next)}
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Estado de acceso
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Los módulos bloqueados requieren permisos adicionales.
                </p>
                <div className="mt-3 space-y-2 text-xs">
                  {modules.map((module) => (
                    <div
                      key={`${module.key}-status`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-700"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {module.label}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 font-semibold',
                          module.enabled
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        )}
                      >
                        {module.enabled ? 'OK' : 'Bloqueado'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <div className="space-y-4 min-w-0">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        activeModule.tone.iconBg,
                        activeModule.tone.iconColor
                      )}
                    >
                      <ActiveIcon className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        {activeModule.label}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {activeModule.description}
                      </p>
                    </div>
                  </div>

                  {searchable && (
                    <div className="w-full lg:w-[360px]">
                      <label
                        htmlFor="admin-settings-search"
                        className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                      >
                        Buscar en {activeModule.label}
                      </label>
                      <div className="relative mt-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input
                          id="admin-settings-search"
                          type="search"
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder={searchPlaceholder}
                          className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-500/30"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <section
                role="tabpanel"
                id={`settings-panel-${tab}`}
                aria-labelledby={`settings-tab-${tab}`}
                className="rounded-2xl border border-slate-200 bg-white/80 p-4 md:p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
              >
                {tab === 'roles' && (
                  <Can perm="rbac:manage_roles">
                    <div className="space-y-6">
                      <RoleList
                        searchTerm={searchTerm}
                        onOpenUsers={(roleId: number) =>
                          setRoleUsersModal({ open: true, roleId })
                        }
                      />
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Tip: usa el botón “Usuarios” para gestionar miembros del
                        rol sin salir de esta pantalla.
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
                  <SpecialIncidentsTable searchTerm={searchTerm} />
                )}

                {tab === 'announcements' && (
                  <Can perm="announcements:read">
                    <AnnouncementsTable searchTerm={searchTerm} />
                  </Can>
                )}

                {tab === 'sociedad' && (
                  <Can perm="society:read">
                    <SocietySettingsTable />
                  </Can>
                )}

                {tab === 'assets' && (
                  <Can perm="assets:full_access">
                    <AssetsBoard />
                  </Can>
                )}

                {tab === 'general' && (
                  <div className="max-w-5xl">
                    <GeneralSettings />
                  </div>
                )}
              </section>
            </div>
          </div>
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
