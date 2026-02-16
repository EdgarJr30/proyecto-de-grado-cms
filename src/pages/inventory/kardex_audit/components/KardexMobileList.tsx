import type { VInventoryKardexRow } from '../../../../types/inventory/inventoryKardex';
import { ArrowDownLeft, ArrowUpRight, Pencil, FileSearch } from 'lucide-react';
import { GhostButton } from './buttons';

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

export function KardexMobileList({
  rows,
  isLoading,
  selectedRows,
  setSelectedRows,
  onRowClick,
}: {
  rows: VInventoryKardexRow[];
  isLoading: boolean;
  selectedRows: VInventoryKardexRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<VInventoryKardexRow[]>>;
  onRowClick: (r: VInventoryKardexRow) => void;
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
        const isOut = r.qty_delta < 0 || r.movement_side === 'OUT';
        const sideIcon = isOut ? ArrowUpRight : ArrowDownLeft;

        const qtyTone = isOut ? 'text-rose-700' : 'text-emerald-700';
        const qtyBg = isOut
          ? 'bg-rose-50 border-rose-200'
          : 'bg-emerald-50 border-emerald-200';
        const SideIcon = sideIcon;

        return (
          <div
            key={`${r.occurred_at}-${r.doc_no ?? 'no'}-${r.part_id}-${r.warehouse_id}-${r.bin_id ?? 'nobin'}-${r.qty_delta}`}
            className={cx(
              'rounded-2xl border bg-white shadow-sm transition',
              'border-slate-200',
              selected && 'ring-2 ring-indigo-300/40'
            )}
          >
            {/* Top strip */}
            <div className="h-10 rounded-t-2xl border-b border-slate-200 bg-indigo-50/50" />

            <div className="p-4 -mt-5">
              {/* Row header */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  checked={selected}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedRows((prev) => [...prev, r]);
                    else setSelectedRows((prev) => prev.filter((x) => x !== r));
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {r.part_code} — {r.part_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 truncate">
                        {r.warehouse_code} — {r.warehouse_name}
                        {r.bin_code ? (
                          <span className="text-slate-400">
                            {' '}
                            · Bin {r.bin_code}
                          </span>
                        ) : (
                          <span className="text-slate-400"> · Bin —</span>
                        )}
                      </div>
                    </div>

                    <span
                      className={cx(
                        'inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full border',
                        qtyBg,
                        qtyTone
                      )}
                      title={isOut ? 'Salida' : 'Entrada'}
                    >
                      <SideIcon className={cx('h-3.5 w-3.5', qtyTone)} />
                      {formatQty(r.qty_delta)}
                    </span>
                  </div>

                  {/* Meta line */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cx(
                        'inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full border',
                        badgeForDocType(r.doc_type)
                      )}
                    >
                      {r.doc_type}
                    </span>

                    <span
                      className={cx(
                        'inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full border',
                        badgeForStatus(r.status)
                      )}
                    >
                      {r.status}
                    </span>

                    <span className="text-[11px] text-slate-500">
                      {shortWhen(r.occurred_at)}
                    </span>

                    {typeof r.ticket_id === 'number' ? (
                      <span className="text-[11px] text-slate-500">
                        Ticket:{' '}
                        <span className="font-semibold text-slate-700">
                          #{r.ticket_id}
                        </span>
                      </span>
                    ) : null}
                  </div>

                  {/* Doc line */}
                  <div className="mt-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      {r.doc_no ?? 'SIN-NO'}
                    </span>
                    {r.reference ? (
                      <span className="text-slate-400"> · {r.reference}</span>
                    ) : null}
                    {r.unit_cost != null ? (
                      <span className="text-slate-400">
                        {' '}
                        · Costo:{' '}
                        {Number(r.unit_cost).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 4,
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex justify-end gap-2">
                <GhostButton onClick={() => onRowClick(r)}>
                  <span className="inline-flex items-center gap-2">
                    <FileSearch className="h-4 w-4" />
                    Ver detalle
                  </span>
                </GhostButton>

                {/* placeholder para futuras acciones (drawer, link a doc, etc.) */}
                <GhostButton
                  onClick={() => onRowClick(r)}
                  title="Abrir (placeholder)"
                >
                  <span className="inline-flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Abrir
                  </span>
                </GhostButton>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
