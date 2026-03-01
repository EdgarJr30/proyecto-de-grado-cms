import type { UomRow } from '../../../../types/inventory';
import { Pencil, Trash2 } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function UomsMobileList({
  rows,
  isLoading,
  selectedRows,
  setSelectedRows,
  canManage,
  onEdit,
  onDelete,
}: {
  rows: UomRow[];
  isLoading: boolean;
  selectedRows: UomRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<UomRow[]>>;
  canManage: boolean;
  onEdit: (row: UomRow) => void;
  onDelete: (row: UomRow) => void;
}) {
  return (
    <div className="md:hidden p-4 space-y-3">
      {isLoading ? (
        <div className="py-10 text-center text-slate-400">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-slate-400">Sin resultados.</div>
      ) : (
        rows.map((r) => {
          const selected = selectedRows.includes(r);

          return (
            <div
              key={r.id}
              className={cx(
                'rounded-xl border border-slate-200 bg-white shadow-sm p-4',
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
                      setSelectedRows((prev) => [...prev, r]);
                      return;
                    }
                    setSelectedRows((prev) => prev.filter((x) => x !== r));
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono font-semibold text-slate-900">{r.code}</div>
                  <div className="mt-1 text-sm text-slate-600">{r.name}</div>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  className={cx(
                    'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border',
                    !canManage
                      ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  )}
                  disabled={!canManage}
                  onClick={() => onEdit(r)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </button>
                <button
                  className={cx(
                    'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                    !canManage
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  )}
                  disabled={!canManage}
                  onClick={() => onDelete(r)}
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
