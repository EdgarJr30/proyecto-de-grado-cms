import { useEffect, useMemo, useState } from 'react';
import { showToastError, showToastSuccess } from '../../../notifications';
import {
  issueTicketTool,
  listAvailableToolsPick,
  listTicketToolRequests,
  listWarehouseBinsPick,
  listWarehousesPick,
  releaseTicketToolReservation,
  reserveTicketTool,
  returnTicketTool,
} from '../../../services/inventory/inventoryRequests';
import type {
  AvailableToolRow,
  TicketToolRequestRow,
  ToolReturnCondition,
  WarehouseBinPick,
  WarehousePick,
} from '../../../types/inventory/inventoryRequests';

type Props = {
  ticketId: number;
  isAccepted: boolean;
  enableWorkflowActions?: boolean;
};

const INPUT_BASE_CLASS =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

const ACTION_INPUT_CLASS =
  'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

const STATUS_LABEL: Record<TicketToolRequestRow['status'], string> = {
  RESERVED: 'Reservada',
  CHECKED_OUT: 'Entregada',
  RETURNED: 'Devuelta',
  CANCELLED: 'Cancelada',
};

const CONDITION_LABEL: Record<ToolReturnCondition, string> = {
  GOOD: 'Buena',
  DAMAGED: 'Dañada',
  MAINTENANCE: 'Requiere mantenimiento',
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
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

export default function TicketToolsPanel({
  ticketId,
  isAccepted,
  enableWorkflowActions = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [tools, setTools] = useState<AvailableToolRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehousePick[]>([]);
  const [rows, setRows] = useState<TicketToolRequestRow[]>([]);
  const [binsByWarehouse, setBinsByWarehouse] = useState<
    Record<string, WarehouseBinPick[]>
  >({});

  const [toolId, setToolId] = useState('');
  const [expectedReturnAt, setExpectedReturnAt] = useState('');
  const [notes, setNotes] = useState('');

  const [returnWarehouseByRow, setReturnWarehouseByRow] = useState<
    Record<string, string>
  >({});
  const [returnBinByRow, setReturnBinByRow] = useState<Record<string, string>>({});
  const [conditionByRow, setConditionByRow] = useState<
    Record<string, ToolReturnCondition>
  >({});

  const toolMap = useMemo(
    () => new Map(tools.map((tool) => [tool.tool_id, tool])),
    [tools]
  );

  const availableTools = useMemo(
    () => tools.filter((tool) => tool.is_available),
    [tools]
  );

  function getToolLabel(id: string) {
    const tool = toolMap.get(id);
    return tool ? `${tool.tool_code} - ${tool.tool_name}` : id;
  }

  function syncActionDrafts(nextRows: TicketToolRequestRow[], nextTools: AvailableToolRow[]) {
    const nextToolMap = new Map(nextTools.map((tool) => [tool.tool_id, tool]));

    setReturnWarehouseByRow((prev) => {
      const next: Record<string, string> = {};
      for (const row of nextRows) {
        const tool = nextToolMap.get(row.tool_id);
        next[row.id] = prev[row.id] ?? tool?.warehouse_id ?? warehouses[0]?.id ?? '';
      }
      return next;
    });

    setReturnBinByRow((prev) => {
      const next: Record<string, string> = {};
      for (const row of nextRows) {
        const tool = nextToolMap.get(row.tool_id);
        next[row.id] = prev[row.id] ?? tool?.bin_id ?? '';
      }
      return next;
    });

    setConditionByRow((prev) => {
      const next: Record<string, ToolReturnCondition> = {};
      for (const row of nextRows) next[row.id] = prev[row.id] ?? 'GOOD';
      return next;
    });
  }

  async function refresh() {
    setLoading(true);
    try {
      const [nextTools, nextWarehouses, nextRows] = await Promise.all([
        listAvailableToolsPick(),
        listWarehousesPick(),
        listTicketToolRequests(ticketId),
      ]);
      setTools(nextTools);
      setWarehouses(nextWarehouses);
      setToolId((prev) =>
        nextTools.some((tool) => tool.is_available && tool.tool_id === prev)
          ? prev
          : nextTools.find((tool) => tool.is_available)?.tool_id ?? ''
      );
      setRows(nextRows);
      if (enableWorkflowActions) syncActionDrafts(nextRows, nextTools);
    } catch (error: unknown) {
      showToastError(errorMessage(error, 'Error cargando herramientas'));
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
    if (!enableWorkflowActions || !isAccepted || rows.length === 0) return;

    const missing = Array.from(
      new Set(
        Object.values(returnWarehouseByRow).filter(
          (warehouse) => warehouse && !binsByWarehouse[warehouse]
        )
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
        showToastError(errorMessage(error, 'Error cargando ubicaciones'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [binsByWarehouse, enableWorkflowActions, isAccepted, returnWarehouseByRow, rows]);

  async function onReserve() {
    if (!isAccepted) {
      showToastError('Este ticket no está aceptado (no es OT).');
      return;
    }
    if (!toolId) {
      showToastError('Selecciona una herramienta disponible.');
      return;
    }

    setLoading(true);
    try {
      await reserveTicketTool({
        ticketId,
        toolId,
        expectedReturnAt: expectedReturnAt
          ? new Date(expectedReturnAt).toISOString()
          : null,
        notes: notes.trim() || null,
      });
      showToastSuccess('Herramienta reservada.');
      setExpectedReturnAt('');
      setNotes('');
      await refresh();
    } catch (error: unknown) {
      showToastError(errorMessage(error, 'No se pudo reservar la herramienta.'));
    } finally {
      setLoading(false);
    }
  }

  async function onIssue(row: TicketToolRequestRow) {
    const key = `${row.id}:ISSUE`;
    setActionBusyKey(key);
    try {
      await issueTicketTool({ ticketId, toolId: row.tool_id });
      showToastSuccess('Entrega de herramienta registrada.');
      await refresh();
    } catch (error: unknown) {
      showToastError(errorMessage(error, 'No se pudo entregar la herramienta.'));
    } finally {
      setActionBusyKey(null);
    }
  }

  async function onReturn(row: TicketToolRequestRow) {
    const warehouseId = returnWarehouseByRow[row.id] ?? '';
    if (!warehouseId) {
      showToastError('Selecciona almacén de devolución.');
      return;
    }

    const key = `${row.id}:RETURN`;
    setActionBusyKey(key);
    try {
      await returnTicketTool({
        ticketId,
        toolId: row.tool_id,
        warehouseId,
        binId: returnBinByRow[row.id] || null,
        condition: conditionByRow[row.id] ?? 'GOOD',
      });
      showToastSuccess('Devolución de herramienta registrada.');
      await refresh();
    } catch (error: unknown) {
      showToastError(errorMessage(error, 'No se pudo devolver la herramienta.'));
    } finally {
      setActionBusyKey(null);
    }
  }

  async function onRelease(row: TicketToolRequestRow) {
    const key = `${row.id}:RELEASE`;
    setActionBusyKey(key);
    try {
      await releaseTicketToolReservation({ ticketId, toolId: row.tool_id });
      showToastSuccess('Reserva de herramienta liberada.');
      await refresh();
    } catch (error: unknown) {
      showToastError(errorMessage(error, 'No se pudo liberar la reserva.'));
    } finally {
      setActionBusyKey(null);
    }
  }

  function isActionBusy(rowId: string, action: 'ISSUE' | 'RETURN' | 'RELEASE') {
    return actionBusyKey === `${rowId}:${action}`;
  }

  if (!isAccepted) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Herramientas: disponible solo cuando el ticket está <b>aceptado</b> (OT).
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Herramienta disponible
            </label>
            <select
              className={INPUT_BASE_CLASS}
              value={toolId}
              onChange={(e) => setToolId(e.target.value)}
              disabled={loading}
            >
              <option value="">Selecciona…</option>
              {availableTools.map((tool) => (
                <option key={tool.tool_id} value={tool.tool_id}>
                  {tool.tool_code} — {tool.tool_name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {toolId
                ? getToolLabel(toolId)
                : 'Solo aparecen herramientas disponibles y sin calibración vencida.'}
            </p>
          </div>

          <div className="xl:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Devolución esperada
            </label>
            <input
              className={INPUT_BASE_CLASS}
              type="datetime-local"
              value={expectedReturnAt}
              onChange={(e) => setExpectedReturnAt(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="xl:col-span-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Nota
            </label>
            <input
              className={INPUT_BASE_CLASS}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              placeholder="Uso previsto, responsable, observación..."
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300 sm:w-auto"
            onClick={() => void onReserve()}
            disabled={loading || !toolId}
          >
            {loading ? 'Reservando…' : 'Reservar herramienta'}
          </button>
        </div>
      </div>

      {!enableWorkflowActions ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          Entregas, devoluciones y liberación de herramientas se gestionan en{' '}
          <b>Inventario → Reservas por OT</b>.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h4 className="text-sm font-semibold text-slate-900">
            Herramientas del ticket
          </h4>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {rows.length} registro{rows.length === 1 ? '' : 's'}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No hay herramientas reservadas todavía.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {rows.map((row) => {
              const returnWarehouse = returnWarehouseByRow[row.id] ?? '';
              const bins = binsByWarehouse[returnWarehouse] ?? [];

              return (
                <article key={row.id} className="space-y-3 px-4 py-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {getToolLabel(row.tool_id)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Estado: {STATUS_LABEL[row.status]} · Reservada:{' '}
                        {formatDateTime(row.reserved_at)} · Dev. esperada:{' '}
                        {formatDateTime(row.expected_return_at)}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {STATUS_LABEL[row.status]}
                    </span>
                  </div>

                  {enableWorkflowActions ? (
                    <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 p-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Entregar
                        </p>
                        <button
                          type="button"
                          className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                          onClick={() => void onIssue(row)}
                          disabled={
                            row.status !== 'RESERVED' ||
                            isActionBusy(row.id, 'ISSUE')
                          }
                        >
                          Entregar
                        </button>
                      </div>

                      <div className="rounded-lg border border-slate-200 p-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Devolver
                        </p>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                          <select
                            className={ACTION_INPUT_CLASS}
                            value={returnWarehouse}
                            onChange={(e) =>
                              setReturnWarehouseByRow((prev) => ({
                                ...prev,
                                [row.id]: e.target.value,
                              }))
                            }
                            disabled={row.status !== 'CHECKED_OUT'}
                          >
                            <option value="">Almacén</option>
                            {warehouses.map((warehouse) => (
                              <option key={warehouse.id} value={warehouse.id}>
                                {warehouse.code} — {warehouse.name}
                              </option>
                            ))}
                          </select>
                          <select
                            className={ACTION_INPUT_CLASS}
                            value={returnBinByRow[row.id] ?? ''}
                            onChange={(e) =>
                              setReturnBinByRow((prev) => ({
                                ...prev,
                                [row.id]: e.target.value,
                              }))
                            }
                            disabled={row.status !== 'CHECKED_OUT'}
                          >
                            <option value="">Sin ubicación</option>
                            {bins.map((bin) => (
                              <option key={bin.id} value={bin.id}>
                                {bin.code} {bin.name ? `— ${bin.name}` : ''}
                              </option>
                            ))}
                          </select>
                          <select
                            className={ACTION_INPUT_CLASS}
                            value={conditionByRow[row.id] ?? 'GOOD'}
                            onChange={(e) =>
                              setConditionByRow((prev) => ({
                                ...prev,
                                [row.id]: e.target.value as ToolReturnCondition,
                              }))
                            }
                            disabled={row.status !== 'CHECKED_OUT'}
                          >
                            {Object.entries(CONDITION_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="h-8 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                            onClick={() => void onReturn(row)}
                            disabled={
                              row.status !== 'CHECKED_OUT' ||
                              isActionBusy(row.id, 'RETURN')
                            }
                          >
                            Devolver
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 p-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Liberar reserva
                        </p>
                        <button
                          type="button"
                          className="h-8 rounded-md bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                          onClick={() => void onRelease(row)}
                          disabled={
                            row.status !== 'RESERVED' ||
                            isActionBusy(row.id, 'RELEASE')
                          }
                        >
                          Liberar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
