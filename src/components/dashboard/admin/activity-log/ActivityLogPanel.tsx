import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCan } from '../../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../../notifications';
import {
  listActivityLog,
  exportActivityLog,
  activityLogToCsv,
  type ActivityLogItem,
  type ActivityLogFilters,
} from '../../../../services/activityLogService';

const PAGE_SIZE = 20;

const RESOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos los módulos' },
  { value: 'tickets', label: 'Tickets / OT' },
  { value: 'users', label: 'Usuarios' },
  { value: 'roles', label: 'Roles' },
  { value: 'rbac', label: 'Permisos (RBAC)' },
  { value: 'auth', label: 'Sesiones' },
  { value: 'assignees', label: 'Técnicos' },
  { value: 'locations', label: 'Ubicaciones' },
  { value: 'societies', label: 'Sociedades' },
  { value: 'special_incidents', label: 'Incidencias' },
  { value: 'announcements', label: 'Anuncios' },
  { value: 'app_settings', label: 'Configuración' },
  { value: 'assets', label: 'Activos' },
  { value: 'parts', label: 'Repuestos' },
  { value: 'tools', label: 'Herramientas' },
  { value: 'ticket_tool_requests', label: 'Reservas de herramientas' },
  { value: 'warehouses', label: 'Almacenes' },
  { value: 'inventory_docs', label: 'Documentos de inventario' },
  { value: 'vendors', label: 'Proveedores' },
  { value: 'client_errors', label: 'Errores de usuario' },
  { value: 'logs', label: 'Bitácora' },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actionBadgeClasses(action: string): string {
  if (action.endsWith('.created') || action.endsWith('.assigned')) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300';
  }
  if (action.endsWith('.updated')) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300';
  }
  if (action.endsWith('.deleted') || action.endsWith('.unassigned')) {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300';
  }
  if (action.startsWith('auth.')) {
    return 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300';
  }
  if (action.startsWith('client_error.')) {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300';
  }
  if (action.includes('comment')) {
    return 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
}

type Props = {
  /** Texto de búsqueda inyectado por el hub de Configuración (opcional). */
  searchTerm?: string;
};

export default function ActivityLogPanel({ searchTerm }: Props) {
  const canExport = useCan('logs:export');

  const [resource, setResource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // El hub pasa su propio buscador; si está presente, tiene prioridad.
  const effectiveSearch = (searchTerm ?? localSearch).trim();

  const filters = useMemo<ActivityLogFilters>(
    () => ({
      search: effectiveSearch || undefined,
      resource: resource || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    }),
    [effectiveSearch, resource, from, to]
  );

  // Reinicia a la primera página cuando cambian los filtros.
  useEffect(() => {
    setPage(0);
  }, [effectiveSearch, resource, from, to]);

  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const { items: rows, total: count } = await listActivityLog({
        filters,
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      if (reqId !== reqIdRef.current) return; // respuesta obsoleta
      setItems(rows);
      setTotal(count);
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      showToastError(
        e instanceof Error ? e.message : 'No se pudo cargar la bitácora.'
      );
      setItems([]);
      setTotal(0);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [filters, page]);

  // Debounce ligero para no disparar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(t);
  }, [load]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const rows = await exportActivityLog(filters);
      if (rows.length === 0) {
        showToastError('No hay registros para exportar con estos filtros.');
        return;
      }
      const csv = activityLogToCsv(rows);
      // BOM (U+FEFF) para que Excel reconozca UTF-8.
      const bom = String.fromCharCode(0xfeff);
      const blob = new Blob([bom + csv], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bitacora_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToastSuccess(`Bitácora exportada (${rows.length} registros).`);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'No se pudo exportar la bitácora.'
      );
    } finally {
      setExporting(false);
    }
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  const inputClasses =
    'h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-500/30';

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Módulo
          </label>
          <select
            value={resource}
            onChange={(e) => setResource(e.target.value)}
            className={cx(inputClasses, 'min-w-[200px]')}
          >
            {RESOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Desde
          </label>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Hasta
          </label>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputClasses}
          />
        </div>

        {searchTerm === undefined && (
          <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Buscar
            </label>
            <input
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Usuario, acción, descripción..."
              className={inputClasses}
            />
          </div>
        )}

        <div className="ml-auto flex items-end gap-2">
          {canExport && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading}
              className="h-10 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? 'Exportando...' : 'Exportar CSV'}
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Acción</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3 text-right">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Cargando bitácora...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No hay registros para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const open = expandedId === item.id;
                return (
                  <Fragment key={item.id}>
                    <tr className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatDate(item.occurredAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {item.actorLabel ?? 'Sistema'}
                        </span>
                        {item.actorRole && (
                          <span className="block text-xs text-slate-400">
                            {item.actorRole}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cx(
                            'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                            actionBadgeClasses(item.action)
                          )}
                        >
                          {item.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {item.summary ?? '—'}
                        {item.entityLabel && (
                          <span className="block text-xs text-slate-400">
                            {item.entityLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : item.id)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {open ? 'Ocultar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50 dark:bg-slate-900/60">
                        <td colSpan={5} className="px-4 py-3">
                          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                            {JSON.stringify(item.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
        <span>
          {total === 0
            ? 'Sin registros'
            : `Mostrando ${rangeStart}–${rangeEnd} de ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Anterior
          </button>
          <span className="text-xs text-slate-500">
            Página {page + 1} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
            disabled={page + 1 >= totalPages || loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
