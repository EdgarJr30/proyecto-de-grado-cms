import { Boxes, Filter, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { InventoryFiltersDropdown } from '../../components/InventoryFiltersDropdown';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function UomsToolbar({
  canManage,
  isLoading,
  selectedCount,
  totalCount,
  search,
  onSearchChange,
  onCreate,
  onBulkDelete,
}: {
  canManage: boolean;
  isLoading: boolean;
  selectedCount: number;
  totalCount: number;
  search: string;
  onSearchChange: (v: string) => void;
  onCreate: () => void;
  onBulkDelete: () => void;
}) {
  return (
    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
      <InventoryFiltersDropdown
        icon={Filter}
        title="Filtros"
        description="Filtra unidades de medida por código o nombre."
        searchValue={search}
        searchPlaceholder="Código o nombre de la UdM..."
        onSearchChange={onSearchChange}
        panelActions={
          <>
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
              Nueva UdM
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
                    ? 'Selecciona al menos 1 UdM'
                    : undefined
              }
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar selección
            </button>
          </>
        }
      />
    </div>
  );
}
