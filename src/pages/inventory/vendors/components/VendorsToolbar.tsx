import type { VendorsTab } from './types';
import { RefreshCw, Truck } from 'lucide-react';
import { PrimaryButton, TabButton } from './buttons';

export function VendorsToolbar({
  tab,
  isLoading,
  onChangeTab,
  search,
  onlyActive,
  onSearchChange,
  onOnlyActiveChange,
  onRefresh,
}: {
  tab: VendorsTab;
  isLoading: boolean;
  onChangeTab: (tab: VendorsTab) => void;
  search: string;
  onlyActive: boolean;
  onSearchChange: (value: string) => void;
  onOnlyActiveChange: (value: boolean) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-blue-50">
                <Truck className="h-5 w-5 text-blue-700" />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Tabs y filtros
                </div>
                <div className="text-xs text-slate-500">
                  Gestiona proveedores o su relación repuesto-proveedor.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <PrimaryButton
                onClick={onRefresh}
                disabled={isLoading}
                icon={RefreshCw}
                title={isLoading ? 'Cargando...' : 'Recargar resultados'}
              >
                Recargar
              </PrimaryButton>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white overflow-hidden">
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

            {tab === 'vendors' ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 lg:ml-auto">
                <input
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="h-10 w-full sm:w-72 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />

                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={onlyActive}
                    onChange={(e) => onOnlyActiveChange(e.target.checked)}
                  />
                  Solo activos
                </label>
              </div>
            ) : (
              <div className="text-sm text-slate-500 lg:ml-auto">
                Selecciona un repuesto para ver o editar sus proveedores.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
