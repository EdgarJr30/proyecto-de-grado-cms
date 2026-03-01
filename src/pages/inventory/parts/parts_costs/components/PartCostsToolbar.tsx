import { DollarSign, RefreshCw } from 'lucide-react';
import { InventoryFiltersDropdown } from '../../../components/InventoryFiltersDropdown';
import { PrimaryButton } from './buttons';

type SortKey = 'updated_at' | 'avg_unit_cost' | 'part_code' | 'warehouse_code';
type SortDir = 'asc' | 'desc';

export function PartCostsToolbar({
  isLoading,

  q,
  onChangeQ,

  warehouseId,
  onChangeWarehouseId,

  partId,
  onChangePartId,

  sortKey,
  sortDir,
  onChangeSortKey,
  onChangeSortDir,

  onReload,
}: {
  isLoading: boolean;

  q: string;
  onChangeQ: (v: string) => void;

  warehouseId: string;
  onChangeWarehouseId: (v: string) => void;

  partId: string;
  onChangePartId: (v: string) => void;

  sortKey: SortKey;
  sortDir: SortDir;
  onChangeSortKey: (v: SortKey) => void;
  onChangeSortDir: (v: SortDir) => void;

  onReload: () => void;
}) {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4">
      <InventoryFiltersDropdown
        icon={DollarSign}
        title="Filtros y orden"
        description="Consulta el costo promedio ponderado por repuesto y almacén."
        searchValue={q}
        searchPlaceholder="Código o nombre de repuesto / almacén…"
        onSearchChange={onChangeQ}
        panelActions={
          <PrimaryButton
            onClick={onReload}
            disabled={isLoading}
            icon={RefreshCw}
            title={isLoading ? 'Cargando…' : undefined}
          >
            Recargar
          </PrimaryButton>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700">
              ID de almacén
            </label>
            <input
              value={warehouseId}
              onChange={(e) => onChangeWarehouseId(e.target.value)}
              placeholder="uuid de almacén"
              className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
            <div className="mt-1 text-[11px] text-slate-500">
              (Por ahora) filtra por UUID.
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700">
              ID de repuesto
            </label>
            <input
              value={partId}
              onChange={(e) => onChangePartId(e.target.value)}
              placeholder="uuid de repuesto"
              className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
            <div className="mt-1 text-[11px] text-slate-500">
              (Por ahora) filtra por UUID.
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700">
              Campo
            </label>
            <select
              value={sortKey}
              onChange={(e) => onChangeSortKey(e.target.value as SortKey)}
              className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="updated_at">Última actualización</option>
              <option value="avg_unit_cost">Costo promedio</option>
              <option value="part_code">Código de repuesto</option>
              <option value="warehouse_code">Código de almacén</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700">
              Dirección
            </label>
            <select
              value={sortDir}
              onChange={(e) => onChangeSortDir(e.target.value as SortDir)}
              className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </div>
        </div>
      </InventoryFiltersDropdown>
    </div>
  );
}
