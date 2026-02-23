import { Boxes, Plus, RefreshCw } from 'lucide-react';
import { GhostButton, PrimaryButton } from './buttons';

export function WarehousesToolbar({
  canManage,
  query,
  showInactive,
  onQueryChange,
  onShowInactiveChange,
  onRefresh,
  onCreate,
}: {
  canManage: boolean;
  query: string;
  showInactive: boolean;
  onQueryChange: (v: string) => void;
  onShowInactiveChange: (v: boolean) => void;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-blue-50">
                <Boxes className="h-5 w-5 text-blue-700" />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Filtros y acciones
                </div>
                <div className="text-xs text-slate-500">
                  Filtra por código, nombre o ubicación y gestiona almacenes.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <GhostButton onClick={onRefresh} icon={RefreshCw}>
                Refrescar
              </GhostButton>

              <PrimaryButton
                onClick={onCreate}
                disabled={!canManage}
                icon={Plus}
                title={
                  !canManage
                    ? 'No tienes permisos para gestionar almacenes'
                    : undefined
                }
              >
                Nuevo
              </PrimaryButton>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Buscar por código, nombre o ubicación..."
              className="h-10 w-full lg:max-w-md rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 lg:ml-auto">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={showInactive}
                onChange={(e) => onShowInactiveChange(e.target.checked)}
              />
              Mostrar inactivos
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
