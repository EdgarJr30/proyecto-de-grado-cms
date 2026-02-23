import { useEffect, useMemo, useState } from 'react';
import { showToastError, showToastSuccess } from '../../../notifications';
import {
  ensureMaintenanceLogForTicketAsset,
  getTicketAssetsByTicketId,
  linkAssetToTicket,
  listAssetOptions,
  setPrimaryAssetForTicket,
  unlinkAssetFromTicket,
} from '../../../services/assetsService';
import type {
  AssetOption,
  AssetStatus,
  BigIntLike,
  TicketAsset,
} from '../../../types/Asset';

type Props = {
  ticketId: number;
  isAccepted: boolean;
  ticketTitle?: string;
  ticketStatus?: string | null;
  requester?: string | null;
  canManageLinks?: boolean;
};

const INPUT_BASE_CLASS =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

function toId(value: BigIntLike): number {
  return typeof value === 'number' ? value : Number(value);
}

function statusLabel(status: AssetStatus) {
  const map: Record<AssetStatus, string> = {
    OPERATIVO: 'Operativo',
    EN_MANTENIMIENTO: 'En mantenimiento',
    FUERA_DE_SERVICIO: 'Fuera de servicio',
    RETIRADO: 'Retirado',
  };
  return map[status];
}

function statusBadgeClass(status: AssetStatus) {
  const map: Record<AssetStatus, string> = {
    OPERATIVO: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    EN_MANTENIMIENTO: 'border-amber-200 bg-amber-50 text-amber-700',
    FUERA_DE_SERVICIO: 'border-rose-200 bg-rose-50 text-rose-700',
    RETIRADO: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return map[status];
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

export default function TicketAssetsPanel({
  ticketId,
  isAccepted,
  ticketTitle,
  ticketStatus,
  requester,
  canManageLinks = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string>('');

  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [links, setLinks] = useState<TicketAsset[]>([]);

  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [markAsPrimary, setMarkAsPrimary] = useState(true);

  const linkedAssetIds = useMemo(
    () => new Set(links.map((row) => toId(row.asset_id))),
    [links]
  );

  const optionsById = useMemo(
    () => new Map(assets.map((asset) => [toId(asset.id), asset])),
    [assets]
  );

  const assignableOptions = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.is_active &&
          asset.status !== 'RETIRADO' &&
          !linkedAssetIds.has(toId(asset.id))
      ),
    [assets, linkedAssetIds]
  );

  const linkedRows = useMemo(() => {
    return links
      .map((row) => {
        const id = toId(row.asset_id);
        return {
          ...row,
          assetId: id,
          asset: optionsById.get(id) ?? null,
        };
      })
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  }, [links, optionsById]);

  async function refresh() {
    setLoading(true);
    setLoadError('');
    try {
      const [assetOptions, ticketLinks] = await Promise.all([
        listAssetOptions({ includeInactive: true }),
        getTicketAssetsByTicketId(ticketId),
      ]);

      setAssets(assetOptions);
      setLinks(ticketLinks);

      if (ticketLinks.length > 0 && !ticketLinks.some((link) => link.is_primary)) {
        const nextPrimary = ticketLinks[0];
        try {
          await setPrimaryAssetForTicket({
            ticket_id: ticketId,
            asset_id: nextPrimary.asset_id,
          });
          const fixedLinks = await getTicketAssetsByTicketId(ticketId);
          setLinks(fixedLinks);
        } catch {
          // Si no hay permiso de update en ticket_assets, mantenemos la carga normal.
        }
      }
    } catch (error: unknown) {
      const msg = errorMessage(error, 'No se pudieron cargar los activos del ticket.');
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAccepted) {
      setAssets([]);
      setLinks([]);
      setLoadError('');
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, isAccepted]);

  useEffect(() => {
    setMarkAsPrimary(links.length === 0);
  }, [links.length]);

  async function handleLinkAsset() {
    if (!canManageLinks) {
      showToastError('No tienes permisos para vincular activos a tickets.');
      return;
    }

    const assetId = Number(selectedAssetId);
    if (!Number.isFinite(assetId) || assetId <= 0) {
      showToastError('Selecciona un activo válido.');
      return;
    }

    if (linkedAssetIds.has(assetId)) {
      showToastError('Ese activo ya está vinculado al ticket.');
      return;
    }

    const shouldBePrimary = links.length === 0 || markAsPrimary;
    const initialPrimaryFlag = links.length === 0;
    setBusyKey('link');
    try {
      await linkAssetToTicket({
        ticket_id: ticketId,
        asset_id: assetId,
        // Si ya hay activos, insertamos como no principal y luego promovemos.
        // Esto evita múltiples primarios si falla el cambio por permisos/políticas.
        is_primary: initialPrimaryFlag,
        created_by: null,
      });

      if (shouldBePrimary && links.length > 0) {
        await setPrimaryAssetForTicket({
          ticket_id: ticketId,
          asset_id: assetId,
        });
      }

      await ensureMaintenanceLogForTicketAsset({
        asset_id: assetId,
        ticket_id: ticketId,
        ticket_title: ticketTitle,
        ticket_status: ticketStatus,
        requester,
      });

      showToastSuccess('Activo vinculado correctamente.');
      setSelectedAssetId('');
      await refresh();
    } catch (error: unknown) {
      const msg = errorMessage(error, 'No se pudo vincular el activo.');
      if (msg.toLowerCase().includes('duplicate key')) {
        showToastError('Ese activo ya estaba vinculado a este ticket.');
      } else {
        showToastError(msg);
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSetPrimary(assetId: number) {
    if (!canManageLinks) return;
    setBusyKey(`primary:${assetId}`);
    try {
      await setPrimaryAssetForTicket({
        ticket_id: ticketId,
        asset_id: assetId,
      });
      setLinks((prev) =>
        prev.map((link) => ({
          ...link,
          is_primary: toId(link.asset_id) === assetId,
        }))
      );
      showToastSuccess('Activo principal actualizado.');
    } catch (error: unknown) {
      showToastError(errorMessage(error, 'No se pudo actualizar el activo principal.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUnlink(assetId: number) {
    if (!canManageLinks) return;
    setBusyKey(`unlink:${assetId}`);
    try {
      const target = links.find((link) => toId(link.asset_id) === assetId);

      await unlinkAssetFromTicket({
        ticket_id: ticketId,
        asset_id: assetId,
      });

      const remaining = links.filter((link) => toId(link.asset_id) !== assetId);
      if (target?.is_primary && remaining.length > 0) {
        await setPrimaryAssetForTicket({
          ticket_id: ticketId,
          asset_id: remaining[0].asset_id,
        });
      }

      showToastSuccess('Activo desvinculado.');
      await refresh();
    } catch (error: unknown) {
      showToastError(errorMessage(error, 'No se pudo desvincular el activo.'));
    } finally {
      setBusyKey(null);
    }
  }

  if (!isAccepted) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Activos fijos: disponible solo cuando el ticket está <b>aceptado</b> (OT).
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {loadError}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Activo fijo
            </label>
            <select
              className={INPUT_BASE_CLASS}
              value={selectedAssetId}
              onChange={(event) => setSelectedAssetId(event.target.value)}
              disabled={loading || busyKey !== null || !canManageLinks}
            >
              <option value="">
                {loading ? 'Cargando activos…' : 'Selecciona un activo…'}
              </option>
              {assignableOptions.map((asset) => (
                <option key={asset.id} value={String(asset.id)}>
                  {asset.code} — {asset.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Vincula el activo afectado para llevar historial de reparaciones por
              equipo.
            </p>
          </div>

          <div className="xl:col-span-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Acción
            </label>
            <button
              type="button"
              className="mt-1 inline-flex h-[46px] w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              onClick={() => void handleLinkAsset()}
              disabled={
                !canManageLinks ||
                loading ||
                busyKey !== null ||
                !selectedAssetId
              }
            >
              {busyKey === 'link' ? 'Vinculando…' : 'Vincular activo'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-start gap-2 text-sm text-slate-700 sm:items-center">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 sm:mt-0"
              checked={markAsPrimary}
              onChange={(event) => setMarkAsPrimary(event.target.checked)}
              disabled={!canManageLinks || busyKey !== null}
            />
            Marcar como activo principal del ticket
          </label>

          {!canManageLinks ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              Solo lectura (requiere <span className="font-mono">assets:update</span>)
            </span>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h4 className="text-sm font-semibold text-slate-900">
            Activos vinculados al ticket
          </h4>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {linkedRows.length} registro{linkedRows.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Cargando activos vinculados…
          </div>
        ) : linkedRows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No hay activos vinculados todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Activo</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Estado</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Ubicación</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Principal</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Vinculado</th>
                  {canManageLinks ? (
                    <th className="px-4 py-2.5 text-left font-semibold">Acciones</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {linkedRows.map((row) => {
                  const status = row.asset?.status;
                  const isPrimaryBusy = busyKey === `primary:${row.assetId}`;
                  const isUnlinkBusy = busyKey === `unlink:${row.assetId}`;

                  return (
                    <tr key={`${row.ticket_id}-${row.asset_id}`} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-900">
                        <div className="font-medium">
                          {row.asset
                            ? `${row.asset.code} — ${row.asset.name}`
                            : `Activo #${row.assetId}`}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {status ? (
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                              status
                            )}`}
                          >
                            {statusLabel(status)}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.asset?.location_name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.is_primary ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Sí
                          </span>
                        ) : (
                          <span className="text-slate-500">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(row.created_at)}
                      </td>
                      {canManageLinks ? (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {!row.is_primary ? (
                              <button
                                type="button"
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => void handleSetPrimary(row.assetId)}
                                disabled={busyKey !== null}
                              >
                                {isPrimaryBusy ? 'Guardando…' : 'Marcar principal'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => void handleUnlink(row.assetId)}
                              disabled={busyKey !== null}
                            >
                              {isUnlinkBusy ? 'Desvinculando…' : 'Desvincular'}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
