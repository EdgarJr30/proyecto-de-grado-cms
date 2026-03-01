import type { VendorsTab } from './types';
import {
  Boxes,
  Filter,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { TabButton } from './buttons';
import { InventoryFiltersDropdown } from '../../components/InventoryFiltersDropdown';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function VendorsToolbar({
  tab,
  isLoading,
  onChangeTab,
  search,
  statusFilter,
  totalCount,
  selectedCount,
  canManage,
  onSearchChange,
  onStatusFilterChange,
  onCreate,
  onBulkDelete,
  onRefresh,
}: {
  tab: VendorsTab;
  isLoading: boolean;
  onChangeTab: (tab: VendorsTab) => void;
  search: string;
  statusFilter: 'all' | 'active' | 'inactive';
  totalCount: number;
  selectedCount: number;
  canManage: boolean;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: 'all' | 'active' | 'inactive') => void;
  onCreate: () => void;
  onBulkDelete: () => void;
  onRefresh: () => void;
}) {
  const isVendorsTab = tab === 'vendors';

  return (
    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
      <div className="flex flex-col gap-3">
        <div className="inline-flex w-fit rounded-md border border-slate-200 bg-white overflow-hidden">
          <TabButton
            active={tab === 'vendors'}
            onClick={() => onChangeTab('vendors')}
          >
            Proveedores
          </TabButton>
          <TabButton
            active={tab === 'part-vendors'}
            onClick={() => onChangeTab('part-vendors')}
            withBorder
          >
            Repuesto-Proveedor
          </TabButton>
        </div>

        {isVendorsTab ? (
          <InventoryFiltersDropdown
            icon={Filter}
            title="Filtros"
            description="Filtra proveedores por nombre, email, teléfono y estado."
            searchValue={search}
            searchPlaceholder="Nombre, email o teléfono..."
            onSearchChange={onSearchChange}
            panelActions={
              <>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className={cx(
                    'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border',
                    isLoading
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
            <div>
              <label className="text-[11px] font-semibold text-slate-700">
                Estado
              </label>
              <select
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
          </InventoryFiltersDropdown>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className={cx(
                'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border',
                isLoading
                  ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              )}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refrescar
            </button>
            Selecciona un repuesto para ver o editar sus proveedores.
          </div>
        )}
      </div>
    </div>
  );
}
