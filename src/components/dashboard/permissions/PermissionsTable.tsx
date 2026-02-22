import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { PERMISSIONS } from '../../../rbac/permissionRegistry';
import { Can } from '../../../rbac/PermissionsContext';
import { syncPermissions } from '../../../rbac/syncPermissions';
import { ChevronDown, Info, ListChecks, RefreshCw, Shield } from 'lucide-react';

type DbPerm = {
  id: string;
  code: string;
  label?: string | null;
  description?: string | null;
};

type PermissionGroup = {
  key: string;
  title: string;
  items: DbPerm[];
};

const RESOURCE_LABELS: Record<string, string> = {
  rbac: 'RBAC',
  home: 'Inicio',
  work_orders: 'Órdenes de trabajo',
  work_requests: 'Solicitudes',
  reports: 'Reportes',
  users: 'Usuarios',
  assignees: 'Técnicos',
  special_incidents: 'Incidencias especiales',
  announcements: 'Anuncios',
  society: 'Sociedad',
  locations: 'Ubicaciones',
  assets: 'Activos',
  inventory: 'Inventario',
};

const ACTION_LABELS: Record<string, string> = {
  read: 'Lectura',
  read_own: 'Lectura propia',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  approve: 'Aprobar',
  assign: 'Asignar',
  disable: 'Activar/Desactivar',
  cancel: 'Cancelar',
  work: 'Operación',
  import: 'Importar',
  export: 'Exportar',
  manage_roles: 'Gestionar roles',
  manage_permissions: 'Gestionar permisos',
  full_access: 'Acceso total',
};

const ACTION_ORDER: Record<string, number> = {
  read: 10,
  read_own: 20,
  create: 30,
  update: 40,
  delete: 50,
  approve: 60,
  assign: 70,
  disable: 80,
  cancel: 90,
  work: 100,
  import: 110,
  export: 120,
  manage_roles: 130,
  manage_permissions: 140,
  full_access: 150,
};

function formatResourceLabel(resource: string) {
  if (RESOURCE_LABELS[resource]) return RESOURCE_LABELS[resource];
  return resource
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getResourceFromCode(code: string) {
  return code.split(':')[0] || 'otros';
}

function getActionFromCode(code: string) {
  return code.split(':')[1] || 'custom';
}

interface Props {
  searchTerm?: string;
}

export default function PermissionsTable({ searchTerm = '' }: Props) {
  const [rows, setRows] = useState<DbPerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    const { data, error } = await supabase
      .from('permissions')
      .select('id,code,label,description')
      .order('code');

    if (error) setMsg(error.message);
    setRows((data ?? []) as DbPerm[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        (r.label ?? '').toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  const grouped = useMemo<PermissionGroup[]>(() => {
    const map = new Map<string, DbPerm[]>();

    for (const perm of filtered) {
      const resource = getResourceFromCode(perm.code);
      const current = map.get(resource) ?? [];
      current.push(perm);
      map.set(resource, current);
    }

    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        title: formatResourceLabel(key),
        items: [...items].sort((a, b) => {
          const actionA = getActionFromCode(a.code);
          const actionB = getActionFromCode(b.code);
          const orderA = ACTION_ORDER[actionA] ?? 999;
          const orderB = ACTION_ORDER[actionB] ?? 999;
          if (orderA !== orderB) return orderA - orderB;
          return a.code.localeCompare(b.code);
        }),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [filtered]);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = {};
      const hasSearch = searchTerm.trim().length > 0;

      grouped.forEach((group) => {
        if (hasSearch) {
          next[group.key] = true;
          return;
        }
        next[group.key] = prev[group.key] ?? false;
      });

      return next;
    });
  }, [grouped, searchTerm]);

  const allOpen =
    grouped.length > 0 && grouped.every((group) => openGroups[group.key]);

  const totalVisible = filtered.length;
  const totalGroups = grouped.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-indigo-600" aria-hidden />
            <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
              Permisos
            </h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {totalVisible} permisos en {totalGroups} grupos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {grouped.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setOpenGroups(
                  Object.fromEntries(
                    grouped.map((group) => [group.key, !allOpen])
                  )
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {allOpen ? 'Contraer todo' : 'Expandir todo'}
            </button>
          )}

          <Can perm="rbac:manage_permissions">
            <button
              className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60"
              title="Sincroniza permisos del registro en código hacia la BD"
              disabled={syncing}
              onClick={async () => {
                try {
                  setSyncing(true);
                  await syncPermissions();
                  await load();
                } finally {
                  setSyncing(false);
                }
              }}
              type="button"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
              />
              <span className="whitespace-nowrap">
                {syncing ? 'Sincronizando…' : 'Sincronizar'}
              </span>
            </button>
          </Can>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-20 rounded-2xl border border-slate-200 bg-white/70 animate-pulse"
            />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            🔎
          </div>
          <p className="text-sm text-slate-500">
            No hay permisos que coincidan con la búsqueda.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => {
            const expanded = Boolean(openGroups[group.key]);
            const panelId = `perm-group-panel-${group.key}`;
            const headingId = `perm-group-heading-${group.key}`;
            return (
              <section
                key={group.key}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  id={headingId}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      [group.key]: !expanded,
                    }))
                  }
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Shield className="h-4 w-4" />
                      </span>
                      <h4 className="truncate text-base font-semibold text-slate-900">
                        {group.title}
                      </h4>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {group.items.length} permiso
                      {group.items.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        expanded ? 'rotate-180' : ''
                      }`}
                    />
                  </span>
                </button>

                {expanded && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headingId}
                    className="border-t border-slate-200 bg-slate-50/60 px-3 py-3 sm:px-4"
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.items.map((perm) => {
                        const action = getActionFromCode(perm.code);
                        const actionLabel =
                          ACTION_LABELS[action] ??
                          action.replace(/_/g, ' ').toUpperCase();
                        return (
                          <article
                            key={perm.id}
                            className="rounded-xl border border-slate-200 bg-white p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <code className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                                {perm.code}
                              </code>
                              <span className="inline-flex shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                                {actionLabel}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-900">
                              {perm.label?.trim() ? perm.label : 'Sin label'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                              {perm.description?.trim()
                                ? perm.description
                                : 'Sin descripción'}
                            </p>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {msg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg}
        </div>
      )}

      <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer font-medium inline-flex items-center gap-2 text-slate-800">
          <Info className="h-4 w-4 text-indigo-600" />
          ¿Qué se sincroniza?
        </summary>
        <p className="mt-3 text-sm text-slate-500">
          Se comparan los permisos definidos en{' '}
          <code className="font-mono">permissionRegistry.ts</code> con la tabla{' '}
          <code className="font-mono">permissions</code> y se
          insertan/actualizan los faltantes. No elimina registros manuales.
        </p>
        <div className="mt-3 text-xs text-slate-500">
          <strong>Total en código:</strong> {PERMISSIONS.length}
        </div>
      </details>
    </div>
  );
}
