import {
  Boxes,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function WarehousesToolbar({
  canManage,
  query,
  statusFilter,
  totalCount,
  selectedCount,
  loading,
  onQueryChange,
  onStatusFilterChange,
  onRefresh,
  onCreate,
  onBulkDelete,
}: {
  canManage: boolean;
  query: string;
  statusFilter: 'all' | 'active' | 'inactive';
  totalCount: number;
  selectedCount: number;
  loading: boolean;
  onQueryChange: (v: string) => void;
  onStatusFilterChange: (v: 'all' | 'active' | 'inactive') => void;
  onRefresh: () => void;
  onCreate: () => void;
  onBulkDelete: () => void;
}) {
  return (
    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Filter className="h-4 w-4 text-blue-700" />
            Filtros
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Buscar
            </label>
            <div className="relative w-full sm:w-[320px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Código, nombre o ubicación..."
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Estado
            </label>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={statusFilter}
              onChange={(event) =>
                onStatusFilterChange(
                  event.target.value as 'all' | 'active' | 'inactive'
                )
              }
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={cx(
              'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border',
              loading
                ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            )}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refrescar
          </button>
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <Boxes className="h-3.5 w-3.5 text-blue-700" />
            {totalCount} items
          </span>
          {selectedCount > 0 ? (
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {selectedCount} seleccionados
            </span>
          ) : null}
          {!canManage ? (
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <ShieldAlert className="h-3.5 w-3.5" />
              Solo lectura
            </span>
          ) : null}
          <button
            type="button"
            onClick={onCreate}
            disabled={!canManage}
            className={cx(
              'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
              !canManage
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            )}
            title={
              !canManage
                ? 'No tienes permisos para gestionar almacenes'
                : undefined
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo
          </button>
          <button
            type="button"
            onClick={onBulkDelete}
            disabled={!canManage || loading || selectedCount === 0}
            className={cx(
              'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
              !canManage || loading || selectedCount === 0
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            )}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar selección
          </button>
        </div>
      </div>
    </div>
  );
}
