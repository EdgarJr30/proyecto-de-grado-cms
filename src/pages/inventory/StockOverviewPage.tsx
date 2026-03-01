import { useEffect, useMemo, useState } from 'react';
import { Boxes, Filter, RefreshCcw, Search } from 'lucide-react';
import { usePermissions } from '../../rbac/PermissionsContext';
import { showToastError } from '../../notifications';

import type { UUID } from '../../types/inventory';
import type { WarehouseRow, VAvailableStockRow } from '../../types/inventory';
import { listWarehouses } from '../../services/inventory';
import { listAvailableStock } from '../../services/inventory';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatQty(n: number) {
  const isInt = Number.isInteger(n);
  return new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: isInt ? 0 : 2,
  }).format(n);
}

function QtyBadge({
  value,
  tone,
}: {
  value: number;
  tone: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const cls =
    tone === 'good'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : tone === 'bad'
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums',
        cls
      )}
    >
      {formatQty(value)}
    </span>
  );
}

function StockRow({ r }: { r: VAvailableStockRow }) {
  const toneAvailable: 'good' | 'warn' | 'bad' =
    r.available_qty <= 0
      ? 'bad'
      : r.available_qty < r.on_hand_qty
        ? 'warn'
        : 'good';

  const toneReserved: 'neutral' | 'warn' =
    r.reserved_qty > 0 ? 'warn' : 'neutral';

  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
      <td className="px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {r.part_code} — {r.part_name}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {r.warehouse_code} — {r.warehouse_name}
          </div>
        </div>
      </td>

      <td className="px-4 py-3 text-right">
        <QtyBadge value={r.on_hand_qty} tone="neutral" />
      </td>

      <td className="px-4 py-3 text-right">
        <QtyBadge value={r.reserved_qty} tone={toneReserved} />
      </td>

      <td className="px-4 py-3 text-right">
        <QtyBadge value={r.available_qty} tone={toneAvailable} />
      </td>
    </tr>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}

export default function StockOverviewPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');

  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [rows, setRows] = useState<VAvailableStockRow[]>([]);
  const [error, setError] = useState('');

  const [warehouseId, setWarehouseId] = useState<UUID | ''>('');
  const [query, setQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyReserved, setOnlyReserved] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [whs, data] = await Promise.all([
        listWarehouses({
          limit: 500,
          orderBy: 'code',
          ascending: true,
          is_active: true,
        }),
        listAvailableStock(
          { warehouse_id: warehouseId ? warehouseId : undefined },
          5000
        ),
      ]);

      setWarehouses(whs);
      setRows(data);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Error desconocido cargando disponibilidad';
      setError(msg);
      showToastError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canRead) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, warehouseId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows
      .filter((r) => {
        if (onlyAvailable && r.available_qty <= 0) return false;
        if (onlyReserved && r.reserved_qty <= 0) return false;

        if (!q) return true;

        const hay =
          r.part_code.toLowerCase().includes(q) ||
          r.part_name.toLowerCase().includes(q) ||
          r.warehouse_code.toLowerCase().includes(q) ||
          r.warehouse_name.toLowerCase().includes(q);

        return hay;
      })
      .sort((a, b) => {
        const pc = a.part_code.localeCompare(b.part_code);
        if (pc !== 0) return pc;
        return a.warehouse_code.localeCompare(b.warehouse_code);
      });
  }, [rows, query, onlyAvailable, onlyReserved]);

  const totals = useMemo(() => {
    let onHand = 0;
    let reserved = 0;
    let available = 0;

    for (const r of filtered) {
      onHand += r.on_hand_qty;
      reserved += r.reserved_qty;
      available += r.available_qty;
    }

    return { onHand, reserved, available, count: filtered.length };
  }, [filtered]);

  if (!canRead) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900">
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No tienes permisos para acceder a disponibilidad de inventario.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900">
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <section className="px-4 md:px-6 lg:px-8 py-6 overflow-auto">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-blue-50">
                      <Filter className="h-5 w-5 text-blue-700" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Filtros de disponibilidad
                      </div>
                      <div className="text-xs text-slate-500">
                        Vista de existencias, reservas y disponible real.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      <Boxes className="h-3.5 w-3.5 text-blue-700" />
                      {loading ? 'Cargando…' : `${filtered.length} resultados`}
                    </span>
                    <button
                      type="button"
                      onClick={() => void load()}
                      className={cx(
                        'inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700',
                        'hover:bg-slate-50'
                      )}
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Refrescar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Buscar
                    </label>
                    <div className="relative mt-1">
                      <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Código o nombre del repuesto, almacén..."
                        className={cx(
                          'h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none',
                          'focus:ring-2 focus:ring-blue-500/30'
                        )}
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Almacén
                    </label>
                    <select
                      value={warehouseId}
                      onChange={(e) =>
                        setWarehouseId((e.target.value as UUID) || '')
                      }
                      className={cx(
                        'mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none',
                        'focus:ring-2 focus:ring-blue-500/30'
                      )}
                    >
                      <option value="">Todos</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.code} — {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-3 flex items-end gap-3">
                    <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={onlyAvailable}
                        onChange={(e) => setOnlyAvailable(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Solo disponibles
                    </label>

                    <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={onlyReserved}
                        onChange={(e) => setOnlyReserved(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Solo reservados
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard label="Filas" value={totals.count} />
                  <StatCard
                    label="En existencia (suma)"
                    value={formatQty(totals.onHand)}
                  />
                  <StatCard
                    label="Reservado (suma)"
                    value={formatQty(totals.reserved)}
                  />
                  <StatCard
                    label="Disponible (suma)"
                    value={formatQty(totals.available)}
                  />
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-slate-100 bg-white flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                Disponibilidad por repuesto/almacén
              </div>
              <div className="text-xs text-slate-500">
                {loading ? 'Cargando...' : `${filtered.length} resultados`}
              </div>
            </div>

            {error ? (
              <div className="p-4 text-sm text-rose-700 bg-rose-50 border-t border-rose-200">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="p-6 text-sm text-slate-500">
                Cargando disponibilidad...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                No hay datos para los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-[860px] w-full">
                  <thead className="bg-slate-50">
                    <tr className="text-xs text-slate-600">
                      <th className="px-4 py-3 text-left font-semibold">
                        Repuesto / Almacén
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        En existencia
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Reservado
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Disponible
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <StockRow key={`${r.part_id}:${r.warehouse_id}`} r={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-5 py-4 border-t border-slate-100 bg-white">
              <div className="text-xs text-slate-500">
                Tip: “Disponible” viene de{' '}
                <span className="font-mono">on_hand_qty - reserved_qty</span>.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
