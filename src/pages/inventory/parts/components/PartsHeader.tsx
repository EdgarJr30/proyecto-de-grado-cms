import { Link } from 'react-router-dom';
import { ChevronRight, PackageSearch, Plus, Trash2 } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function PartsHeader(props: {
  totalCount: number;
  selectedCount: number;
  canManage: boolean;
  isLoading: boolean;
  onCreate: () => void;
  onBulkDelete: () => void;
}) {
  const {
    totalCount,
    selectedCount,
    canManage,
    isLoading,
    onCreate,
    onBulkDelete,
  } = props;

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="px-4 md:px-6 lg:px-8 py-4">
        <div className="flex flex-col gap-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link to="/inventario" className="hover:text-slate-900">
              Inventario
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-900 font-medium">Repuestos</span>
          </nav>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-blue-50">
                <PackageSearch className="h-5 w-5 text-blue-700" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg md:text-xl font-bold tracking-tight">
                    Repuestos
                  </h1>

                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {totalCount} resultados
                  </span>

                  {selectedCount > 0 ? (
                    <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {selectedCount} seleccionados
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Catálogo de repuestos con UdM, categoría, criticidad y
                  banderas operativas.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
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
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
