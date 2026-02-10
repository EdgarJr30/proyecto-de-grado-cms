import { useEffect, useMemo, useState } from 'react';
import { showToastError, showToastSuccess } from '../../notifications';
import type {
  AvailableStockRow,
  PartPick,
  TicketPartRequestRow,
  WarehousePick,
} from '../../types/inventory/inventoryRequests';
import {
  getAvailableStock,
  listPartsPick,
  listTicketPartRequests,
  listWarehousesPick,
  reserveTicketPart,
} from '../../services/inventory/inventoryRequests';

type Props = {
  ticketId: number;
  isAccepted: boolean;
};

function fmt(n: number) {
  return new Intl.NumberFormat('es-DO', { maximumFractionDigits: 3 }).format(n);
}

export default function TicketPartsPanel({ ticketId, isAccepted }: Props) {
  const [loading, setLoading] = useState(false);

  const [parts, setParts] = useState<PartPick[]>([]);
  const [warehouses, setWarehouses] = useState<WarehousePick[]>([]);
  const [rows, setRows] = useState<TicketPartRequestRow[]>([]);

  const [partId, setPartId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [qty, setQty] = useState<string>('1');
  const [allowBackorder, setAllowBackorder] = useState(false);

  const [avail, setAvail] = useState<AvailableStockRow | null>(null);

  const qtyNumber = useMemo(() => Number(qty), [qty]);

  async function refresh() {
    setLoading(true);
    try {
      const [p, w, r] = await Promise.all([
        listPartsPick(),
        listWarehousesPick(),
        listTicketPartRequests(ticketId),
      ]);
      setParts(p);
      setWarehouses(w);
      setRows(r);
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('Error cargando repuestos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAccepted) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, isAccepted]);

  useEffect(() => {
    if (!isAccepted) return;
    if (!partId || !warehouseId) {
      setAvail(null);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const a = await getAvailableStock(partId, warehouseId);
        if (!cancelled) setAvail(a);
      } catch (error: unknown) {
        if (!cancelled) {
          if (error instanceof Error) showToastError(error.message);
          else showToastError('Error obteniendo disponibilidad');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [partId, warehouseId, isAccepted]);

  async function onReserve() {
    if (!isAccepted) {
      showToastError('Este ticket no está aceptado (no es WO).');
      return;
    }
    if (!partId || !warehouseId) {
      showToastError('Selecciona repuesto y almacén.');
      return;
    }
    if (!Number.isFinite(qtyNumber) || qtyNumber <= 0) {
      showToastError('La cantidad debe ser > 0.');
      return;
    }

    setLoading(true);
    try {
      await reserveTicketPart({
        ticketId,
        partId,
        warehouseId,
        qty: qtyNumber,
        allowBackorder,
      });

      showToastSuccess('Reserva creada.');
      setQty('1');
      setAllowBackorder(false);
      await refresh();

      // refresca disponibilidad
      const a = await getAvailableStock(partId, warehouseId);
      setAvail(a);
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('No se pudo reservar.');
    } finally {
      setLoading(false);
    }
  }

  if (!isAccepted) {
    return (
      <div className="rounded-xl border border-white/10 p-4 text-sm text-white/70">
        Repuestos: disponible solo cuando el ticket está <b>aceptado</b> (WO).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="rounded-xl border border-white/10 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/70">Repuesto</label>
            <select
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
              value={partId}
              onChange={(e) => setPartId(e.target.value)}
              disabled={loading}
            >
              <option value="">Selecciona…</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/70">Almacén</label>
            <select
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              disabled={loading}
            >
              <option value="">Selecciona…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/70">Cantidad</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              disabled={loading}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-white/70">
            {avail ? (
              <>
                <span className="mr-3">
                  OnHand: <b>{fmt(avail.on_hand_qty)}</b>
                </span>
                <span className="mr-3">
                  Reserved: <b>{fmt(avail.reserved_qty)}</b>
                </span>
                <span>
                  Available: <b>{fmt(avail.available_qty)}</b>
                </span>
              </>
            ) : (
              <span>
                Selecciona repuesto + almacén para ver disponibilidad.
              </span>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={allowBackorder}
              onChange={(e) => setAllowBackorder(e.target.checked)}
              disabled={loading}
            />
            Permitir backorder
          </label>

          <button
            className="rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
            onClick={onReserve}
            disabled={loading}
          >
            Reservar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 text-sm font-medium">
          Repuestos del ticket
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-2 text-left">Part</th>
                <th className="px-4 py-2 text-right">Requested</th>
                <th className="px-4 py-2 text-right">Reserved</th>
                <th className="px-4 py-2 text-right">Issued</th>
                <th className="px-4 py-2 text-right">Returned</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-white/60" colSpan={5}>
                    No hay repuestos reservados todavía.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="px-4 py-2">{r.part_id}</td>
                    <td className="px-4 py-2 text-right">
                      {fmt(r.requested_qty)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {fmt(r.reserved_qty)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {fmt(r.issued_qty)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {fmt(r.returned_qty)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
