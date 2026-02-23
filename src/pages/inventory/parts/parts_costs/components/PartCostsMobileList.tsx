import type { VPartCostRow } from '../../../../../types/inventory';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function money(v: number) {
  // Simple y seguro (sin Intl config por país para no romper en SSR/entornos raros)
  // Si prefieres Intl.NumberFormat('es-DO', { style:'currency', currency:'DOP' }) lo cambiamos luego.
  const n = Number.isFinite(v) ? v : 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function PartCostsMobileList({
  rows,
  isLoading,
  selectedRows,
  setSelectedRows,
}: {
  rows: VPartCostRow[];
  isLoading: boolean;
  selectedRows: VPartCostRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<VPartCostRow[]>>;
}) {
  if (isLoading) {
    return <div className="py-10 text-center text-slate-400">Cargando…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-slate-400">Sin resultados.</div>
    );
  }

  return (
    <div className="md:hidden space-y-3">
      {rows.map((r) => {
        const selected = selectedRows.includes(r);

        return (
          <div
            key={`${r.part_id}-${r.warehouse_id}`}
            className={cx(
              'rounded-2xl border bg-white shadow-sm transition',
              'border-slate-200',
              selected && 'ring-2 ring-emerald-300/40'
            )}
          >
            <div className="h-10 rounded-t-2xl border-b border-slate-200 bg-emerald-50/60" />

            <div className="p-4 -mt-5">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  checked={selected}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedRows((prev) => [...prev, r]);
                    else setSelectedRows((prev) => prev.filter((x) => x !== r));
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {r.part_code
                          ? `${r.part_code} — ${r.part_name}`
                          : r.part_name || r.part_id}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Almacén:{' '}
                        <span className="font-medium text-slate-700">
                          {r.warehouse_code
                            ? `${r.warehouse_code} — ${r.warehouse_name}`
                            : r.warehouse_name || r.warehouse_id}
                        </span>
                      </div>
                    </div>

                    <span className="shrink-0 inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Prom.: {money(r.avg_unit_cost)}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <div className="text-[11px] text-slate-500">
                        ID de repuesto
                      </div>
                      <div className="mt-0.5 text-xs font-mono text-slate-800 break-all">
                        {r.part_id}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <div className="text-[11px] text-slate-500">
                        Actualizado
                      </div>
                      <div className="mt-0.5 text-xs text-slate-800">
                        {new Date(r.updated_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-2">
                      <div className="text-[11px] text-slate-500">
                        ID de almacén
                      </div>
                      <div className="mt-0.5 text-xs font-mono text-slate-800 break-all">
                        {r.warehouse_id}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-400">
                    Vista de costo promedio ponderado por almacén (solo
                    lectura).
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
