import { Ruler, Plus, Trash2 } from 'lucide-react';
import { DangerButton, PrimaryButton } from './buttons';

export function UomsToolbar({
  canManage,
  isLoading,
  selectedCount,
  totalCount,
  filteredCount,
  search,
  onSearchChange,
  onCreate,
  onBulkDelete,
}: {
  canManage: boolean;
  isLoading: boolean;
  selectedCount: number;
  totalCount: number;
  filteredCount: number;
  search: string;
  onSearchChange: (v: string) => void;
  onCreate: () => void;
  onBulkDelete: () => void;
}) {
  const isFiltering = search.trim().length >= 2;

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4">
          {/* Top row: icon + description + actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-indigo-50">
                <Ruler className="h-5 w-5 text-indigo-700" />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Acciones
                </div>
                <div className="text-xs text-slate-500">
                  Crea, edita o elimina unidades de medida para compras, consumo
                  e inventario.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <PrimaryButton
                onClick={onCreate}
                disabled={!canManage}
                title={
                  !canManage
                    ? 'No tienes permiso para gestionar maestros'
                    : undefined
                }
                icon={Plus}
              >
                Nueva UdM
              </PrimaryButton>

              <DangerButton
                onClick={onBulkDelete}
                disabled={!canManage || isLoading || selectedCount === 0}
                title={
                  !canManage
                    ? 'No tienes permiso para gestionar maestros'
                    : selectedCount === 0
                      ? 'Selecciona al menos 1 UdM'
                      : undefined
                }
                icon={Trash2}
              >
                Eliminar selección
              </DangerButton>
            </div>
          </div>

          {/* Bottom row: search + counters */}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <label className="sr-only">Buscar</label>
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Buscar por código o nombre (min. 2 caracteres)…"
                  className={[
                    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pl-10 text-sm',
                    'text-slate-900 placeholder:text-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300',
                  ].join(' ')}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  🔎
                </div>
              </div>

              <div className="mt-2 text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                {isFiltering ? (
                  <span>
                    Mostrando{' '}
                    <span className="font-semibold text-slate-700">
                      {filteredCount}
                    </span>{' '}
                    de{' '}
                    <span className="font-semibold text-slate-700">
                      {totalCount}
                    </span>
                  </span>
                ) : (
                  <span>
                    Total:{' '}
                    <span className="font-semibold text-slate-700">
                      {totalCount}
                    </span>
                  </span>
                )}

                {selectedCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                    Seleccionadas:{' '}
                    <span className="font-semibold">{selectedCount}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
