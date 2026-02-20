import { useEffect, useMemo, useState } from 'react';
import { showToastError, showToastSuccess } from '../../../notifications';
import type {
  AvailableStockRow,
  PartPick,
  TicketPartRequestRow,
  WarehousePick,
} from '../../../types/inventory/inventoryRequests';
import {
  getAvailableStock,
  listPartsPick,
  listTicketPartRequests,
  listWarehousesPick,
  reserveTicketPart,
} from '../../../services/inventory/inventoryRequests';

type Props = {
  ticketId: number;
  isAccepted: boolean;
};

const INPUT_BASE_CLASS =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

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
  const partMap = useMemo(
    () => new Map(parts.map((part) => [part.id, part])),
    [parts]
  );
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses]
  );
  const canReserve =
    !loading &&
    Boolean(partId) &&
    Boolean(warehouseId) &&
    Number.isFinite(qtyNumber) &&
    qtyNumber > 0;

  function getPartLabel(id: string) {
    const part = partMap.get(id);
    return part ? `${part.code} - ${part.name}` : id;
  }

  function getWarehouseLabel(id: string) {
    const warehouse = warehouseMap.get(id);
    return warehouse ? `${warehouse.code} - ${warehouse.name}` : id;
  }

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
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Repuestos: disponible solo cuando el ticket está <b>aceptado</b> (WO).
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Repuesto
            </label>
            <select
              className={INPUT_BASE_CLASS}
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
            <p className="mt-1 text-xs text-slate-500">
              {partId
                ? getPartLabel(partId)
                : 'Elige el repuesto a reservar para esta orden.'}
            </p>
          </div>

          <div className="xl:col-span-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Almacén
            </label>
            <select
              className={INPUT_BASE_CLASS}
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
            <p className="mt-1 text-xs text-slate-500">
              {warehouseId
                ? getWarehouseLabel(warehouseId)
                : 'Selecciona el almacén donde se hará la reserva.'}
            </p>
          </div>

          <div className="xl:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Cantidad
            </label>
            <input
              className={INPUT_BASE_CLASS}
              type="number"
              min="0.001"
              step="0.001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-slate-500">
              Usa decimales si el repuesto permite fracciones.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            aria-live="polite"
          >
            {avail ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    OnHand
                  </p>
                  <p className="text-base font-semibold text-slate-900">
                    {fmt(avail.on_hand_qty)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Reserved
                  </p>
                  <p className="text-base font-semibold text-slate-900">
                    {fmt(avail.reserved_qty)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Available
                  </p>
                  <p className="text-base font-semibold text-emerald-700">
                    {fmt(avail.available_qty)}
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500 sm:col-span-3">
                Selecciona repuesto + almacén para ver disponibilidad.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-start gap-2 text-sm text-slate-700 sm:items-center">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 sm:mt-0"
                checked={allowBackorder}
                onChange={(e) => setAllowBackorder(e.target.checked)}
                disabled={loading}
              />
              Permitir backorder si no hay disponibilidad inmediata
            </label>

            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300 sm:w-auto"
              onClick={onReserve}
              disabled={!canReserve}
            >
              {loading ? 'Reservando…' : 'Reservar repuesto'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h4 className="text-sm font-semibold text-slate-900">
            Repuestos del ticket
          </h4>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {rows.length} registro{rows.length === 1 ? '' : 's'}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No hay repuestos reservados todavía.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">
                      Repuesto
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold">
                      Almacén
                    </th>
                    <th className="px-4 py-2.5 text-right font-semibold">
                      Solicitado
                    </th>
                    <th className="px-4 py-2.5 text-right font-semibold">
                      Reservado
                    </th>
                    <th className="px-4 py-2.5 text-right font-semibold">
                      Entregado
                    </th>
                    <th className="px-4 py-2.5 text-right font-semibold">
                      Devuelto
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-900">
                        {getPartLabel(r.part_id)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {getWarehouseLabel(r.warehouse_id)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {fmt(r.requested_qty)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {fmt(r.reserved_qty)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {fmt(r.issued_qty)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {fmt(r.returned_qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 md:hidden">
              {rows.map((r) => (
                <article key={r.id} className="space-y-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {getPartLabel(r.part_id)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {getWarehouseLabel(r.warehouse_id)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                        Solicitado
                      </p>
                      <p className="font-semibold text-slate-800">
                        {fmt(r.requested_qty)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                        Reservado
                      </p>
                      <p className="font-semibold text-slate-800">
                        {fmt(r.reserved_qty)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                        Entregado
                      </p>
                      <p className="font-semibold text-slate-800">
                        {fmt(r.issued_qty)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                        Devuelto
                      </p>
                      <p className="font-semibold text-slate-800">
                        {fmt(r.returned_qty)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
