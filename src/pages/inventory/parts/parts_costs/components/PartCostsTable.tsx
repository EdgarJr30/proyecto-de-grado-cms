// src/pages/inventory/costing/PartCostsPage/components/PartCostsTable.tsx
import { type RefObject } from 'react';
import type { VPartCostRow } from '../../../../../types/inventory';
import { DollarSign } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function money(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function PartCostsTable({
  rows,
  isLoading,
  selectedRows,
  setSelectedRows,
  checked,
  indeterminate,
  onToggleAll,
  checkboxRef,
}: {
  rows: VPartCostRow[];
  isLoading: boolean;
  selectedRows: VPartCostRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<VPartCostRow[]>>;
  checked: boolean;
  indeterminate: boolean;
  onToggleAll: () => void;
  checkboxRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="hidden md:block">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="h-11 border-b border-slate-200 bg-emerald-50/60" />

        <div className="-mt-6 p-4">
          <div className="overflow-auto rounded-xl ring-1 ring-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 w-12">
                    <input
                      ref={checkboxRef}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      checked={checked}
                      onChange={onToggleAll}
                      aria-label="Seleccionar todo"
                    />
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Repuesto
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Almacén
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-700" />
                      Costo promedio
                    </span>
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Actualizado
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    IDs
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-slate-400"
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-slate-400"
                    >
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const selected = selectedRows.includes(r);

                    const partLabel =
                      r.part_code && r.part_name
                        ? `${r.part_code} — ${r.part_name}`
                        : r.part_name || r.part_id;

                    const whLabel =
                      r.warehouse_code && r.warehouse_name
                        ? `${r.warehouse_code} — ${r.warehouse_name}`
                        : r.warehouse_name || r.warehouse_id;

                    return (
                      <tr
                        key={`${r.part_id}-${r.warehouse_id}`}
                        className={cx(
                          'transition',
                          selected ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                        )}
                      >
                        <td className="relative px-6 w-12">
                          {selected && (
                            <div className="absolute inset-y-0 left-0 w-0.5 bg-emerald-600" />
                          )}

                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                            checked={selected}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedRows((prev) => [...prev, r]);
                              else
                                setSelectedRows((prev) =>
                                  prev.filter((x) => x !== r)
                                );
                            }}
                            aria-label={`Seleccionar ${partLabel} (${whLabel})`}
                          />
                        </td>

                        <td className="px-4 py-4 min-w-[260px]">
                          <div className="text-sm font-semibold text-slate-900">
                            {partLabel}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 font-mono">
                            {r.part_code
                              ? `Repuesto: ${r.part_code}`
                              : 'Repuesto: —'}
                          </div>
                        </td>

                        <td className="px-4 py-4 min-w-[240px]">
                          <div className="text-sm text-slate-900">
                            {whLabel}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 font-mono">
                            {r.warehouse_code
                              ? `ALM: ${r.warehouse_code}`
                              : 'ALM: —'}
                          </div>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {money(r.avg_unit_cost)}
                          </span>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">
                          {new Date(r.updated_at).toLocaleString()}
                        </td>

                        <td className="px-4 py-4 min-w-[420px]">
                          <div className="grid grid-cols-2 gap-2">
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
                                ID de almacén
                              </div>
                              <div className="mt-0.5 text-xs font-mono text-slate-800 break-all">
                                {r.warehouse_id}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {indeterminate ? (
            <div className="mt-3 text-xs text-slate-500">
              Hay selección parcial (no todas las filas están seleccionadas).
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
