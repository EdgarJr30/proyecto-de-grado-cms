import type { UomRow } from '../../../../types/inventory';

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
    <div className="md:hidden mt-4 space-y-3">
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
                'rounded-2xl border bg-white p-4 shadow-sm',
                selected
                  ? 'border-indigo-200 ring-1 ring-indigo-200'
                  : 'border-slate-200'
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  checked={selected}
                  disabled={!canManage}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedRows((prev) => [...prev, r]);
                    else setSelectedRows((prev) => prev.filter((x) => x !== r));
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-mono font-semibold text-slate-900">
                      {r.code}
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      UdM
                    </span>
                  </div>

                  <div className="mt-1 text-sm text-slate-600">{r.name}</div>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-4">
                <button
                  className="text-indigo-600 hover:text-indigo-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!canManage}
                  onClick={() => onEdit(r)}
                >
                  Editar
                </button>
                <button
                  className="text-rose-600 hover:text-rose-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!canManage}
                  onClick={() => onDelete(r)}
                >
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
