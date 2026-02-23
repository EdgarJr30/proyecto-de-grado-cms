import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
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
  // Mantén simple: entero si no tiene decimales; si no, 2 decimales
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
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : tone === 'bad'
          ? 'bg-rose-50 text-rose-800 border-rose-200'
          : 'bg-gray-50 text-gray-800 border-gray-200';

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
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
    <tr className="border-b last:border-b-0 hover:bg-gray-50/60">
      <td className="px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {r.part_code} — {r.part_name}
          </div>
          <div className="text-xs text-gray-500 truncate">
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

export default function StockOverviewPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');

  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [rows, setRows] = useState<VAvailableStockRow[]>([]);
  const [error, setError] = useState<string>('');

  // Filtros UI
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
    // recargar cuando cambia el warehouse
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
        // Orden por part_code, luego warehouse_code
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
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
              No tienes permisos para acceder a disponibilidad de inventario.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />

      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <header className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-bold">Disponibilidad</h2>
                <p className="text-sm text-gray-600">
                  Vista <span className="font-mono">v_available_stock</span> (on
                  hand / reservado / disponible real).
                </p>
              </div>

              <button
                type="button"
                onClick={() => void load()}
                className={cx(
                  'shrink-0 rounded-xl border bg-white px-4 py-2 text-sm shadow-sm',
                  'hover:bg-gray-50 active:scale-[0.99]'
                )}
              >
                Refrescar
              </button>
            </div>
          </div>
        </header>

        <section className="px-4 md:px-6 lg:px-8 py-4 overflow-auto">
          {/* Filtros */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-5">
                <label className="block text-xs font-medium text-gray-700">
                  Buscar
                </label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Código o nombre del repuesto, almacén…"
                  className={cx(
                    'mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none',
                    'focus:ring-2 focus:ring-gray-200'
                  )}
                />
              </div>

              <div className="lg:col-span-4">
                <label className="block text-xs font-medium text-gray-700">
                  Almacén
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) =>
                    setWarehouseId((e.target.value as UUID) || '')
                  }
                  className={cx(
                    'mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none',
                    'focus:ring-2 focus:ring-gray-200'
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
                <label className="flex items-center gap-2 rounded-xl border bg-gray-50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                  />
                  Solo disponibles
                </label>

                <label className="flex items-center gap-2 rounded-xl border bg-gray-50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={onlyReserved}
                    onChange={(e) => setOnlyReserved(e.target.checked)}
                  />
                  Solo reservados
                </label>
              </div>
            </div>

            {/* KPIs */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-xs text-gray-500">Filas</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {totals.count}
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-xs text-gray-500">En existencia (suma)</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {formatQty(totals.onHand)}
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-xs text-gray-500">Reservado (sum)</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {formatQty(totals.reserved)}
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-xs text-gray-500">Disponible (sum)</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {formatQty(totals.available)}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="mt-4 rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">
                Disponibilidad por repuesto/almacén
              </div>
              <div className="text-xs text-gray-500">
                {loading ? 'Cargando…' : `${filtered.length} resultados`}
              </div>
            </div>

            {error ? (
              <div className="p-4 text-sm text-rose-700 bg-rose-50 border-t">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="p-6 text-sm text-gray-600">
                Cargando disponibilidad…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-gray-600">
                No hay datos para los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-[860px] w-full">
                  <thead className="bg-gray-50">
                    <tr className="text-xs text-gray-600">
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
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Tip: “Disponible” viene de{' '}
            <span className="font-mono">on_hand_qty - reserved_qty</span>.
          </div>
        </section>
      </main>
    </div>
  );
}
