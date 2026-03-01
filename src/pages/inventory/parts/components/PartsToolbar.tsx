import type { PartCriticality } from '../../../../types/inventory';
import { Boxes, Filter, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { InventoryFiltersDropdown } from '../../components/InventoryFiltersDropdown';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function PartsToolbar(props: {
  q: string;
  setQ: (v: string) => void;
  activeFilter: 'all' | 'active' | 'inactive';
  setActiveFilter: (v: 'all' | 'active' | 'inactive') => void;
  critFilter: PartCriticality | '';
  setCritFilter: (v: PartCriticality | '') => void;
  totalCount: number;
  selectedCount: number;
  canManage: boolean;
  isLoading: boolean;
  onCreate: () => void;
  onBulkDelete: () => void;
}) {
  const {
    q,
    setQ,
    activeFilter,
    setActiveFilter,
    critFilter,
    setCritFilter,
    totalCount,
    selectedCount,
    canManage,
    isLoading,
    onCreate,
    onBulkDelete,
  } = props;

  return (
    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
      <InventoryFiltersDropdown
        icon={Filter}
        title="Filtros"
        description="Filtra por estado, criticidad, código, nombre o descripción."
        searchValue={q}
        searchPlaceholder="Código, nombre, descripción…"
        onSearchChange={setQ}
        panelActions={
          <>
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
                  ? 'No tienes permiso para gestionar maestros'
                  : undefined
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo
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
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar selección
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-700">
              Activo
            </label>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={activeFilter}
              onChange={(e) =>
                setActiveFilter(e.target.value as 'all' | 'active' | 'inactive')
              }
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-700">
              Criticidad
            </label>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={critFilter}
              onChange={(e) => setCritFilter(e.target.value as PartCriticality | '')}
            >
              <option value="">Todas</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>
        </div>
      </InventoryFiltersDropdown>
    </div>
  );
}
