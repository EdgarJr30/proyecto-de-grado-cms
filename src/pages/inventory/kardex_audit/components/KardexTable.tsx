import { type RefObject } from 'react';
import type { VInventoryKardexRow } from '../../../../types/inventory/inventoryKardex';
import { FileSearch, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { GhostButton } from './buttons';
import { localizeReference } from '../../inventory_docs/components/docMeta';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatQty(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  return `${sign}${abs.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })}`;
}

function formatMoney(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function shortWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function badgeForDocType(t: VInventoryKardexRow['doc_type']) {
  switch (t) {
    case 'RECEIPT':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ISSUE':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'RETURN':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'TRANSFER':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'ADJUSTMENT':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function badgeForStatus(s: VInventoryKardexRow['status']) {
  switch (s) {
    case 'POSTED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function labelDocType(t: VInventoryKardexRow['doc_type']) {
  switch (t) {
    case 'RECEIPT':
      return 'Entrada';
    case 'ISSUE':
      return 'Salida';
    case 'RETURN':
      return 'Devolución';
    case 'TRANSFER':
      return 'Transferencia';
    case 'ADJUSTMENT':
      return 'Ajuste';
  }
}

function labelStatus(s: VInventoryKardexRow['status']) {
  switch (s) {
    case 'POSTED':
      return 'Publicado';
    case 'DRAFT':
      return 'Borrador';
    case 'CANCELLED':
      return 'Cancelado';
  }
}

function labelMovementSide(side: VInventoryKardexRow['movement_side']) {
  if (side === 'IN') return 'Entrada';
  if (side === 'OUT') return 'Salida';
  return '—';
}

export function KardexTable({
  rows,
  isLoading,
  selectedRows,
  setSelectedRows,
  checked,
  indeterminate,
  onToggleAll,
  checkboxRef,
  onRowClick,
}: {
  rows: VInventoryKardexRow[];
  isLoading: boolean;
  selectedRows: VInventoryKardexRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<VInventoryKardexRow[]>>;
  checked: boolean;
  indeterminate: boolean;
  onToggleAll: () => void;
  checkboxRef: RefObject<HTMLInputElement | null>;
  onRowClick: (r: VInventoryKardexRow) => void;
}) {
  return (
    <div className="hidden md:block">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="h-11 border-b border-slate-200 bg-indigo-50/50" />

        <div className="-mt-6 p-4">
          <div className="overflow-auto rounded-xl ring-1 ring-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 w-12">
                    <input
                      ref={checkboxRef}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                      checked={checked}
                      onChange={onToggleAll}
                      aria-label="Seleccionar todo"
                    />
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Documento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Tipo / Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Repuesto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Almacén / Ubicación
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Ticket
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">
                    Costo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-10 text-center text-slate-400"
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-10 text-center text-slate-400"
                    >
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const selected = selectedRows.includes(r);

                    const isOut = r.qty_delta < 0 || r.movement_side === 'OUT';
                    const qtyTone = isOut
                      ? 'text-rose-700'
                      : 'text-emerald-700';
                    const qtyBg = isOut
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-emerald-50 border-emerald-200';
                    const SideIcon = isOut ? ArrowUpRight : ArrowDownLeft;

                    return (
                      <tr
                        key={`${r.occurred_at}-${r.doc_no ?? 'no'}-${r.part_id}-${r.warehouse_id}-${r.bin_id ?? 'nobin'}-${r.qty_delta}`}
                        className={cx(
                          'transition',
                          selected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                        )}
                      >
                        <td className="relative px-6 w-12">
                          {selected && (
                            <div className="absolute inset-y-0 left-0 w-0.5 bg-indigo-600" />
                          )}
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                            checked={selected}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedRows((prev) => [...prev, r]);
                              else
                                setSelectedRows((prev) =>
                                  prev.filter((x) => x !== r)
                                );
                            }}
                            aria-label={`Seleccionar ${r.doc_no ?? 'movimiento'}`}
                          />
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {shortWhen(r.occurred_at)}
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                            {r.doc_no ?? 'SIN-NO'}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                            {localizeReference(r.reference) ?? '—'}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cx(
                                'inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full border',
                                badgeForDocType(r.doc_type)
                              )}
                            >
                              {labelDocType(r.doc_type)}
                            </span>
                            <span
                              className={cx(
                                'inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full border',
                                badgeForStatus(r.status)
                              )}
                            >
                              {labelStatus(r.status)}
                            </span>
                          </div>
                          {r.movement_side ? (
                            <div className="mt-1 text-[11px] text-slate-500">
                              Lado:{' '}
                              <span className="font-semibold text-slate-700">
                                {labelMovementSide(r.movement_side)}
                              </span>
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                            {r.part_code}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                            {r.part_name}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                            {r.warehouse_code}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                            {r.warehouse_name}
                            <span className="text-slate-400">
                              {' '}
                              · Ubicación {r.bin_code ?? '—'}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {typeof r.ticket_id === 'number'
                            ? `#${r.ticket_id}`
                            : '—'}
                        </td>

                        <td className="px-4 py-4 text-right">
                          <span
                            className={cx(
                              'inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full border',
                              qtyBg,
                              qtyTone
                            )}
                            title={isOut ? 'Salida' : 'Entrada'}
                          >
                            <SideIcon className="h-3.5 w-3.5" />
                            {formatQty(r.qty_delta)}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right text-sm text-slate-700 whitespace-nowrap">
                          {formatMoney(r.unit_cost)}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <GhostButton onClick={() => onRowClick(r)}>
                              <span className="inline-flex items-center gap-2">
                                <FileSearch className="h-4 w-4" />
                                Ver
                              </span>
                            </GhostButton>
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
