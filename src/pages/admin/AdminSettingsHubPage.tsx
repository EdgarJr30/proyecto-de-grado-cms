import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  ChevronDown,
  KeyRound,
  Megaphone,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Sidebar from '../../components/layout/Sidebar';
import { Can, useCan } from '../../rbac/PermissionsContext';
import GeneralSettings from '../../components/dashboard/admin/settings/GeneralSettings';
import RoleList from '../../components/dashboard/roles/RoleList';
import PermissionsTable from '../../components/dashboard/permissions/PermissionsTable';
import RoleUsersModal from './RoleUsersModal';
import SpecialIncidentsTable from '../../components/dashboard/special-incidents/SpecialIncidentsTable';
import AnnouncementsTable from '../../components/dashboard/admin/announcements/AnnouncementsTable';
import SocietySettingsTable from '../../components/dashboard/society/SocietySettingsDetail';
import ActivityLogPanel from '../../components/dashboard/admin/activity-log/ActivityLogPanel';
import ApprovalProcessesPanel from '../../components/dashboard/admin/approvals/ApprovalProcessesPanel';

type TabKey =
  | 'general'
  | 'roles'
  | 'permissions'
  | 'incidents'
  | 'announcements'
  | 'sociedad'
  | 'logs'
  | 'approvals';

type SettingsModule = {
  key: TabKey;
  label: string;
  description: string;
  icon: LucideIcon;
  enabled: boolean;
};

const TAB_ORDER: TabKey[] = [
  'roles',
  'permissions',
  'incidents',
  'announcements',
  'sociedad',
  'approvals',
  'logs',
  'general',
];

const SEARCHABLE_TABS = new Set<TabKey>([
  'roles',
  'permissions',
  'incidents',
  'announcements',
]);

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

function SettingsModulePicker({
  modules,
  value,
  onChange,
}: {
  modules: SettingsModule[];
  value: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const activeModule = modules.find((module) => module.key === value) ?? modules[0];
  const ActiveIcon = activeModule.icon;

  return (
    <label className="flex w-full max-w-[28rem] items-center gap-3 rounded-xl border border-slate-300/20 bg-slate-950/20 px-4 py-2 text-sm text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] dark:border-slate-600/60 dark:bg-slate-950/30">
      <span className="shrink-0 text-slate-400">Módulo</span>
      <span className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-2 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/10">
          <ActiveIcon className="h-4 w-4" />
        </span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as TabKey)}
          className="h-10 w-full appearance-none rounded-lg border border-slate-500/40 bg-slate-950/30 py-0 pl-12 pr-10 text-sm font-semibold text-slate-100 outline-none transition hover:border-slate-400/70 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
        >
          {modules.map((module) => (
            <option key={module.key} value={module.key}>
              {module.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
      </span>
    </label>
  );
}

export default function AdminSettingsHubPage() {
  const q = useQuery();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

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

  const canViewLogs = useCan(['logs:read', 'logs:export']);
  const canManageApprovals = useCan('approvals:full_access');

  const modules = useMemo<SettingsModule[]>(
    () => [
      {
        key: 'roles',
        label: 'Roles',
        description: 'Gestiona los roles y su asignación de permisos.',
        icon: ShieldCheck,
        enabled: canManageRoles,
      },
      {
        key: 'permissions',
        label: 'Permisos',
        description: 'Administra códigos, descripciones y sincronización de permisos.',
        icon: KeyRound,
        enabled: canSeePermissions,
      },
      {
        key: 'incidents',
        label: 'Incidencias',
        description: 'Mantén incidencias especiales para clasificación operativa.',
        icon: AlertTriangle,
        enabled: canManageIncidents,
      },
      {
        key: 'announcements',
        label: 'Anuncios',
        description: 'Publica avisos por rol y controla vigencia/visibilidad.',
        icon: Megaphone,
        enabled: canManageAnnouncements,
      },
      {
        key: 'sociedad',
        label: 'Sociedad',
        description: 'Configura nombre, branding e identidad institucional.',
        icon: Building2,
        enabled: canManageSociety,
      },
      {
        key: 'approvals',
        label: 'Aprobaciones',
        description: 'Crea procesos de validación y asigna aprobadores y solicitantes.',
        icon: BadgeCheck,
        enabled: canManageApprovals,
      },
      {
        key: 'logs',
        label: 'Bitácora',
        description: 'Audita las acciones realizadas en la plataforma.',
        icon: ScrollText,
        enabled: canViewLogs,
      },
      {
        key: 'general',
        label: 'General',
        description: 'Ajustes transversales del sistema y catálogos base.',
        icon: Settings,
        enabled: true,
      },
    ],
    [
      canManageRoles,
      canSeePermissions,
      canManageIncidents,
      canManageAnnouncements,
      canManageSociety,
      canViewLogs,
      canManageApprovals,
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
  const availableModules = useMemo(
    () => modules.filter((module) => module.enabled),
    [modules]
  );

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

  const revealProps = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14, scale: 0.996 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: {
            duration: 0.46,
            delay,
            ease: [0.22, 1, 0.36, 1] as const,
          },
        };

  return (
    <div className="h-screen flex bg-[#f4f6fb] text-slate-900 dark:bg-[#061224] dark:text-slate-100">
      <Sidebar />

      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 min-w-0">
        <motion.header
          className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-0"
          {...revealProps(0.04)}
        >
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-5 shadow-sm dark:border-slate-800/90 dark:from-[#071426] dark:via-[#081629] dark:to-[#061224] dark:shadow-[0_24px_90px_rgba(0,0,0,0.18)] md:p-6">
            <div className="absolute inset-x-6 top-0 hidden h-32 rounded-full bg-sky-500/5 blur-3xl dark:block" />
            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-4xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700/80 dark:bg-slate-950/30 dark:text-slate-300">
                  <Sparkles className="h-3.5 w-3.5 text-sky-500 dark:text-sky-300" />
                  Centro de configuración
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Configuración
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Organiza roles, permisos, incidencias, anuncios, datos de
                  sociedad y parámetros globales desde una sola vista.
                </p>

                <div className="mt-8">
                  <SettingsModulePicker
                    modules={availableModules}
                    value={tab}
                    onChange={(next) => setTab(next)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 xl:min-w-[28rem]">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-950/20">
                  <p className="text-slate-500 dark:text-slate-400">Submódulos</p>
                  <p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">
                    {modules.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-950/20">
                  <p className="text-slate-500 dark:text-slate-400">Disponibles</p>
                  <p className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {enabledCount}
                  </p>
                </div>
                <div className="col-span-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:col-span-1 dark:border-slate-700/80 dark:bg-slate-950/20">
                  <p className="text-slate-500 dark:text-slate-400">Módulo activo</p>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {activeModule.label}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        <section className="flex-1 overflow-auto px-4 pb-8 pt-4 md:px-6 lg:px-8">
          <motion.div className="min-w-0" {...revealProps(0.16)}>
            <section
              role="tabpanel"
              id={`settings-panel-${tab}`}
              aria-label={`Submódulo ${activeModule.label}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700/80 dark:bg-[#071426]/85 dark:shadow-[0_20px_80px_rgba(0,0,0,0.16)]"
            >
              <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-start lg:justify-between dark:border-slate-700/80">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-500 ring-1 ring-teal-400/10 dark:bg-teal-400/10 dark:text-teal-300">
                    <ActiveIcon className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
                      {activeModule.label}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
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
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-600 dark:bg-slate-950/40 dark:text-slate-100 dark:focus:ring-sky-500/30"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={
                      prefersReducedMotion
                        ? undefined
                        : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }
                    }
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

                    {tab === 'approvals' && (
                      <Can perm="approvals:full_access">
                        <ApprovalProcessesPanel />
                      </Can>
                    )}

                    {tab === 'logs' && (
                      <Can perm={['logs:read', 'logs:export']}>
                        <ActivityLogPanel />
                      </Can>
                    )}

                    {tab === 'general' && (
                      <div className="max-w-5xl">
                        <GeneralSettings />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </section>
          </motion.div>
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
