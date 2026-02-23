import { useEffect, useMemo, useState } from 'react';
import { showToastError, showToastSuccess } from '../../../notifications';
import type {
  AvailableStockRow,
  PartPick,
  TicketPartRequestRow,
  WarehouseBinPick,
  WarehousePick,
} from '../../../types/inventory/inventoryRequests';
import {
  getAvailableStock,
  issueTicketPart,
  listPartsPick,
  listTicketPartRequests,
  listWarehouseBinsPick,
  listWarehousesPick,
  releaseTicketPartReservation,
  reserveTicketPart,
  returnTicketPart,
} from '../../../services/inventory/inventoryRequests';

type Props = {
  ticketId: number;
  isAccepted: boolean;
  enableWorkflowActions?: boolean;
};

const INPUT_BASE_CLASS =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

const ACTION_INPUT_CLASS =
  'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

function fmt(n: number) {
  return new Intl.NumberFormat('es-DO', { maximumFractionDigits: 3 }).format(n);
}

function defaultActionQty(maxQty: number) {
  if (!Number.isFinite(maxQty) || maxQty <= 0) return '';
  return maxQty >= 1 ? '1' : String(Number(maxQty.toFixed(3)));
}

function toQty(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeNumericDraft(value: string): string {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return '';

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return '';

  return String(Object.is(parsed, -0) ? 0 : parsed);
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return String((error as { message: string }).message);
  }
  return fallback;
}

export default function TicketPartsPanel({
  ticketId,
  isAccepted,
  enableWorkflowActions = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);

  const [parts, setParts] = useState<PartPick[]>([]);
  const [warehouses, setWarehouses] = useState<WarehousePick[]>([]);
  const [rows, setRows] = useState<TicketPartRequestRow[]>([]);
  const [binsByWarehouse, setBinsByWarehouse] = useState<
    Record<string, WarehouseBinPick[]>
  >({});

  const [partId, setPartId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [qty, setQty] = useState<string>('1');
  const [allowBackorder, setAllowBackorder] = useState(false);

  const [avail, setAvail] = useState<AvailableStockRow | null>(null);

  const [issueQtyByRow, setIssueQtyByRow] = useState<Record<string, string>>({});
  const [returnQtyByRow, setReturnQtyByRow] = useState<Record<string, string>>({});
  const [releaseQtyByRow, setReleaseQtyByRow] = useState<Record<string, string>>(
    {}
  );
  const [fromBinByRow, setFromBinByRow] = useState<Record<string, string>>({});
  const [toBinByRow, setToBinByRow] = useState<Record<string, string>>({});

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

  const normalizeQty = () => {
    setQty((prev) => normalizeNumericDraft(prev));
  };

  const normalizeActionQtyByRow = (
    rowId: string,
    setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>
  ) => {
    setDraft((prev) => {
      const current = prev[rowId] ?? '';
      const normalized = normalizeNumericDraft(current);
      if (normalized === current) return prev;
      return { ...prev, [rowId]: normalized };
    });
  };

  function syncActionDrafts(nextRows: TicketPartRequestRow[]) {
    const rowIds = new Set(nextRows.map((r) => r.id));

    setIssueQtyByRow((prev) => {
      const next: Record<string, string> = {};
      for (const row of nextRows) {
        next[row.id] =
          prev[row.id] ?? defaultActionQty(Math.max(row.reserved_qty, 0));
      }
      return next;
    });

    setReturnQtyByRow((prev) => {
      const next: Record<string, string> = {};
      for (const row of nextRows) {
        next[row.id] =
          prev[row.id] ??
          defaultActionQty(Math.max(row.issued_qty - row.returned_qty, 0));
      }
      return next;
    });

    setReleaseQtyByRow((prev) => {
      const next: Record<string, string> = {};
      for (const row of nextRows) {
        next[row.id] =
          prev[row.id] ?? defaultActionQty(Math.max(row.reserved_qty, 0));
      }
      return next;
    });

    setFromBinByRow((prev) => {
      const next: Record<string, string> = {};
      for (const key of Object.keys(prev)) {
        if (rowIds.has(key)) next[key] = prev[key];
      }
      return next;
    });

    setToBinByRow((prev) => {
      const next: Record<string, string> = {};
      for (const key of Object.keys(prev)) {
        if (rowIds.has(key)) next[key] = prev[key];
      }
      return next;
    });
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
      if (enableWorkflowActions) syncActionDrafts(r);
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
  }, [ticketId, isAccepted, enableWorkflowActions]);

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

  useEffect(() => {
    if (!enableWorkflowActions || !isAccepted || rows.length === 0) return;

    const missing = Array.from(
      new Set(
        rows
          .map((row) => row.warehouse_id)
          .filter((warehouse) => !binsByWarehouse[warehouse])
      )
    );

    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const loaded = await Promise.all(
          missing.map(async (warehouse) => ({
            warehouse,
            bins: await listWarehouseBinsPick(warehouse),
          }))
        );
        if (cancelled) return;

        setBinsByWarehouse((prev) => {
          const next = { ...prev };
          for (const item of loaded) next[item.warehouse] = item.bins;
          return next;
        });
      } catch (error: unknown) {
        if (error instanceof Error) showToastError(error.message);
        else showToastError('Error cargando ubicaciones del almacén');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [binsByWarehouse, enableWorkflowActions, isAccepted, rows]);

  async function onReserve() {
    if (!isAccepted) {
      showToastError('Este ticket no está aceptado (no es OT).');
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

      const a = await getAvailableStock(partId, warehouseId);
      setAvail(a);
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('No se pudo reservar.');
    } finally {
      setLoading(false);
    }
  }

  function pendingIssueQty(row: TicketPartRequestRow) {
    return Math.max(row.reserved_qty, 0);
  }

  function pendingReturnQty(row: TicketPartRequestRow) {
    return Math.max(row.issued_qty - row.returned_qty, 0);
  }

  function isActionBusy(rowId: string, action: 'ISSUE' | 'RETURN' | 'RELEASE') {
    return actionBusyKey === `${rowId}:${action}`;
  }

  async function onIssue(row: TicketPartRequestRow) {
    const max = pendingIssueQty(row);
    if (max <= 0) {
      showToastError('No hay cantidad reservada pendiente para entregar.');
      return;
    }

    const draft = issueQtyByRow[row.id] ?? '';
    const qtyToIssue = toQty(draft);
    if (!Number.isFinite(qtyToIssue) || qtyToIssue <= 0) {
      showToastError('Cantidad de entrega inválida.');
      return;
    }
    if (qtyToIssue > max) {
      showToastError(`No puedes entregar más de lo reservado (${fmt(max)}).`);
      return;
    }

    const key = `${row.id}:ISSUE`;
    setActionBusyKey(key);
    try {
      const docId = await issueTicketPart({
        ticketId,
        partId: row.part_id,
        warehouseId: row.warehouse_id,
        qty: qtyToIssue,
        fromBinId: fromBinByRow[row.id] || null,
      });
      showToastSuccess(`Entrega registrada. Doc: ${docId}`);
      await refresh();
    } catch (error: unknown) {
      showToastError(errorMessage(error, 'No se pudo registrar la entrega.'));
    } finally {
      setActionBusyKey(null);
    }
  }

  async function onReturn(row: TicketPartRequestRow) {
    const max = pendingReturnQty(row);
    if (max <= 0) {
      showToastError('No hay cantidad pendiente para devolución.');
      return;
    }

    const draft = returnQtyByRow[row.id] ?? '';
    const qtyToReturn = toQty(draft);
    if (!Number.isFinite(qtyToReturn) || qtyToReturn <= 0) {
      showToastError('Cantidad de devolución inválida.');
      return;
    }
    if (qtyToReturn > max) {
      showToastError(`No puedes devolver más de lo pendiente (${fmt(max)}).`);
      return;
    }

    const key = `${row.id}:RETURN`;
    setActionBusyKey(key);
    try {
      const docId = await returnTicketPart({
        ticketId,
        partId: row.part_id,
        warehouseId: row.warehouse_id,
        qty: qtyToReturn,
        toBinId: toBinByRow[row.id] || null,
      });
      showToastSuccess(`Devolución registrada. Doc: ${docId}`);
      await refresh();
    } catch (error: unknown) {
      showToastError(errorMessage(error, 'No se pudo registrar la devolución.'));
    } finally {
      setActionBusyKey(null);
    }
  }

  async function onRelease(row: TicketPartRequestRow) {
    const max = pendingIssueQty(row);
    if (max <= 0) {
      showToastError('No hay cantidad reservada para liberar.');
      return;
    }

    const draft = releaseQtyByRow[row.id] ?? '';
    const qtyToRelease = toQty(draft);
    if (!Number.isFinite(qtyToRelease) || qtyToRelease <= 0) {
      showToastError('Cantidad de liberación inválida.');
      return;
    }
    if (qtyToRelease > max) {
      showToastError(`No puedes liberar más de lo reservado (${fmt(max)}).`);
      return;
    }

    const key = `${row.id}:RELEASE`;
    setActionBusyKey(key);
    try {
      await releaseTicketPartReservation({
        ticketId,
        partId: row.part_id,
        warehouseId: row.warehouse_id,
        qty: qtyToRelease,
      });
      showToastSuccess('Reserva liberada.');
      await refresh();
    } catch (error: unknown) {
      showToastError(errorMessage(error, 'No se pudo liberar la reserva.'));
    } finally {
      setActionBusyKey(null);
    }
  }

  if (!isAccepted) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Repuestos: disponible solo cuando el ticket está <b>aceptado</b> (OT).
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onBlur={normalizeQty}
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
                    En existencia
                  </p>
                  <p className="text-base font-semibold text-slate-900">
                    {fmt(avail.on_hand_qty)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Reservado
                  </p>
                  <p className="text-base font-semibold text-slate-900">
                    {fmt(avail.reserved_qty)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Disponible
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
              Permitir pedido pendiente si no hay disponibilidad inmediata
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

      {!enableWorkflowActions ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          Entregas, devoluciones y liberación de reservas se gestionan en{' '}
          <b>Inventario → Reservas por OT</b>.
        </div>
      ) : null}

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
                    {enableWorkflowActions ? (
                      <th className="px-4 py-2.5 text-left font-semibold">
                        Flujo OT
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((r) => {
                    const pendingIssue = pendingIssueQty(r);
                    const pendingReturn = pendingReturnQty(r);
                    const bins = binsByWarehouse[r.warehouse_id] ?? [];
                    const hasBins = bins.length > 0;

                    return (
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

                        {enableWorkflowActions ? (
                          <td className="px-4 py-3">
                            <div className="space-y-2 min-w-[280px]">
                              <div className="rounded-lg border border-slate-200 p-2">
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Entregar (SALIDA) · Pendiente: {fmt(pendingIssue)}
                                </div>
                                {hasBins ? (
                                  <select
                                    className={`${ACTION_INPUT_CLASS} mb-1`}
                                    value={fromBinByRow[r.id] ?? ''}
                                    onChange={(e) =>
                                      setFromBinByRow((prev) => ({
                                        ...prev,
                                        [r.id]: e.target.value,
                                      }))
                                    }
                                    disabled={isActionBusy(r.id, 'ISSUE')}
                                  >
                                    <option value="">Auto ubicación</option>
                                    {bins.map((b) => (
                                      <option key={b.id} value={b.id}>
                                        {b.code} {b.name ? `— ${b.name}` : ''}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                                <div className="flex items-center gap-2">
                                  <input
                                    className={ACTION_INPUT_CLASS}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={issueQtyByRow[r.id] ?? ''}
                                    onChange={(e) =>
                                      setIssueQtyByRow((prev) => ({
                                        ...prev,
                                        [r.id]: e.target.value,
                                      }))
                                    }
                                    onBlur={() =>
                                      normalizeActionQtyByRow(
                                        r.id,
                                        setIssueQtyByRow
                                      )
                                    }
                                    disabled={isActionBusy(r.id, 'ISSUE')}
                                  />
                                  <button
                                    type="button"
                                    className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                                    onClick={() => void onIssue(r)}
                                    disabled={
                                      pendingIssue <= 0 || isActionBusy(r.id, 'ISSUE')
                                    }
                                  >
                                    Entregar
                                  </button>
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-200 p-2">
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Devolver (DEVOLUCIÓN) · Pendiente: {fmt(pendingReturn)}
                                </div>
                                {hasBins ? (
                                  <select
                                    className={`${ACTION_INPUT_CLASS} mb-1`}
                                    value={toBinByRow[r.id] ?? ''}
                                    onChange={(e) =>
                                      setToBinByRow((prev) => ({
                                        ...prev,
                                        [r.id]: e.target.value,
                                      }))
                                    }
                                    disabled={isActionBusy(r.id, 'RETURN')}
                                  >
                                    <option value="">Auto ubicación</option>
                                    {bins.map((b) => (
                                      <option key={b.id} value={b.id}>
                                        {b.code} {b.name ? `— ${b.name}` : ''}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                                <div className="flex items-center gap-2">
                                  <input
                                    className={ACTION_INPUT_CLASS}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={returnQtyByRow[r.id] ?? ''}
                                    onChange={(e) =>
                                      setReturnQtyByRow((prev) => ({
                                        ...prev,
                                        [r.id]: e.target.value,
                                      }))
                                    }
                                    onBlur={() =>
                                      normalizeActionQtyByRow(
                                        r.id,
                                        setReturnQtyByRow
                                      )
                                    }
                                    disabled={isActionBusy(r.id, 'RETURN')}
                                  />
                                  <button
                                    type="button"
                                    className="h-8 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                                    onClick={() => void onReturn(r)}
                                    disabled={
                                      pendingReturn <= 0 ||
                                      isActionBusy(r.id, 'RETURN')
                                    }
                                  >
                                    Devolver
                                  </button>
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-200 p-2">
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Liberar reserva
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    className={ACTION_INPUT_CLASS}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={releaseQtyByRow[r.id] ?? ''}
                                    onChange={(e) =>
                                      setReleaseQtyByRow((prev) => ({
                                        ...prev,
                                        [r.id]: e.target.value,
                                      }))
                                    }
                                    onBlur={() =>
                                      normalizeActionQtyByRow(
                                        r.id,
                                        setReleaseQtyByRow
                                      )
                                    }
                                    disabled={isActionBusy(r.id, 'RELEASE')}
                                  />
                                  <button
                                    type="button"
                                    className="h-8 rounded-md bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                                    onClick={() => void onRelease(r)}
                                    disabled={
                                      pendingIssue <= 0 ||
                                      isActionBusy(r.id, 'RELEASE')
                                    }
                                  >
                                    Liberar
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 md:hidden">
              {rows.map((r) => {
                const pendingIssue = pendingIssueQty(r);
                const pendingReturn = pendingReturnQty(r);
                const bins = binsByWarehouse[r.warehouse_id] ?? [];
                const hasBins = bins.length > 0;

                return (
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

                    {enableWorkflowActions ? (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-slate-200 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Entregar (Pendiente {fmt(pendingIssue)})
                          </p>
                          {hasBins ? (
                            <select
                              className={`${ACTION_INPUT_CLASS} mt-1`}
                              value={fromBinByRow[r.id] ?? ''}
                              onChange={(e) =>
                                setFromBinByRow((prev) => ({
                                  ...prev,
                                  [r.id]: e.target.value,
                                }))
                              }
                              disabled={isActionBusy(r.id, 'ISSUE')}
                            >
                              <option value="">Auto ubicación</option>
                              {bins.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.code} {b.name ? `— ${b.name}` : ''}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              className={ACTION_INPUT_CLASS}
                              type="number"
                              min="0"
                              step="any"
                              value={issueQtyByRow[r.id] ?? ''}
                              onChange={(e) =>
                                setIssueQtyByRow((prev) => ({
                                  ...prev,
                                  [r.id]: e.target.value,
                                }))
                              }
                              onBlur={() =>
                                normalizeActionQtyByRow(r.id, setIssueQtyByRow)
                              }
                              disabled={isActionBusy(r.id, 'ISSUE')}
                            />
                            <button
                              type="button"
                              className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                              onClick={() => void onIssue(r)}
                              disabled={
                                pendingIssue <= 0 || isActionBusy(r.id, 'ISSUE')
                              }
                            >
                              Entregar
                            </button>
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Devolver (Pendiente {fmt(pendingReturn)})
                          </p>
                          {hasBins ? (
                            <select
                              className={`${ACTION_INPUT_CLASS} mt-1`}
                              value={toBinByRow[r.id] ?? ''}
                              onChange={(e) =>
                                setToBinByRow((prev) => ({
                                  ...prev,
                                  [r.id]: e.target.value,
                                }))
                              }
                              disabled={isActionBusy(r.id, 'RETURN')}
                            >
                              <option value="">Auto ubicación</option>
                              {bins.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.code} {b.name ? `— ${b.name}` : ''}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              className={ACTION_INPUT_CLASS}
                              type="number"
                              min="0"
                              step="any"
                              value={returnQtyByRow[r.id] ?? ''}
                              onChange={(e) =>
                                setReturnQtyByRow((prev) => ({
                                  ...prev,
                                  [r.id]: e.target.value,
                                }))
                              }
                              onBlur={() =>
                                normalizeActionQtyByRow(r.id, setReturnQtyByRow)
                              }
                              disabled={isActionBusy(r.id, 'RETURN')}
                            />
                            <button
                              type="button"
                              className="h-8 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                              onClick={() => void onReturn(r)}
                              disabled={
                                pendingReturn <= 0 || isActionBusy(r.id, 'RETURN')
                              }
                            >
                              Devolver
                            </button>
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Liberar reserva
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              className={ACTION_INPUT_CLASS}
                              type="number"
                              min="0"
                              step="any"
                              value={releaseQtyByRow[r.id] ?? ''}
                              onChange={(e) =>
                                setReleaseQtyByRow((prev) => ({
                                  ...prev,
                                  [r.id]: e.target.value,
                                }))
                              }
                              onBlur={() =>
                                normalizeActionQtyByRow(
                                  r.id,
                                  setReleaseQtyByRow
                                )
                              }
                              disabled={isActionBusy(r.id, 'RELEASE')}
                            />
                            <button
                              type="button"
                              className="h-8 rounded-md bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                              onClick={() => void onRelease(r)}
                              disabled={
                                pendingIssue <= 0 || isActionBusy(r.id, 'RELEASE')
                              }
                            >
                              Liberar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
