import type { VendorRow } from '../../../../types/inventory';
import { Pencil, Trash2 } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function VendorsMobileList({
  rows,
  loading,
  canManage,
  selectedRows,
  setSelectedRows,
  onEdit,
  onDelete,
}: {
  rows: VendorRow[];
  loading: boolean;
  canManage: boolean;
  selectedRows: VendorRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<VendorRow[]>>;
  onEdit: (row: VendorRow) => void;
  onDelete: (row: VendorRow) => void;
}) {
  return (
    <div className="md:hidden p-4 space-y-3">
      {loading ? (
        <div className="py-10 text-center text-slate-400">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-slate-400">Sin proveedores.</div>
      ) : (
        rows.map((row) => {
          const selected = selectedRows.includes(row);

          return (
            <div
              key={row.id}
              className={cx(
                'rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
                selected && 'ring-2 ring-blue-500/20'
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  checked={selected}
                  disabled={!canManage}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedRows((prev) => [...prev, row]);
                      return;
                    }
                    setSelectedRows((prev) => prev.filter((x) => x !== row));
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{row.name}</div>
                  <div className="mt-1 text-xs text-slate-500 truncate">
                    {row.email ?? 'Sin email'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 truncate">
                    {row.phone ?? 'Sin teléfono'}
                  </div>
                  <div className="mt-2">
                    {row.is_active ? (
                      <span className="inline-flex px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                        Inactivo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className={cx(
                    'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border',
                    !canManage
                      ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  )}
                  disabled={!canManage}
                  onClick={() => onEdit(row)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </button>
                <button
                  type="button"
                  className={cx(
                    'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                    !canManage
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  )}
                  disabled={!canManage}
                  onClick={() => onDelete(row)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
