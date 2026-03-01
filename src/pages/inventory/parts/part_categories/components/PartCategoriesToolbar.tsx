import { Boxes, Filter, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function PartCategoriesToolbar({
  search,
  onSearchChange,
  totalCount,
  canManage,
  isLoading,
  selectedCount,
  onCreate,
  onBulkDelete,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  canManage: boolean;
  isLoading: boolean;
  selectedCount: number;
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
            <div className="relative w-full sm:w-[360px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="Nombre o ruta de la categoría..."
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <Boxes className="h-3.5 w-3.5 text-blue-700" />
            {totalCount} items
          </span>
          {selectedCount > 0 ? (
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {selectedCount} seleccionadas
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
                ? 'No tienes permiso para gestionar maestros'
                : undefined
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva categoría
          </button>
          <button
            type="button"
            onClick={onBulkDelete}
            disabled={!canManage || isLoading || selectedCount === 0}
            className={cx(
              'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
              !canManage || isLoading || selectedCount === 0
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            )}
            title={
              !canManage
                ? 'No tienes permiso para gestionar maestros'
                : selectedCount === 0
                  ? 'Selecciona al menos 1 categoría'
                  : undefined
            }
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar selección
          </button>
        </div>
      </div>
    </div>
  );
}
