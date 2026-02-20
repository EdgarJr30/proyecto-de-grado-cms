import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MapPinned } from 'lucide-react';
import Sidebar from '../../components/layout/Sidebar';
import { usePermissions } from '../../rbac/PermissionsContext';
import { showToastError } from '../../notifications';
import type { UUID, VStockByLocationRow } from '../../types/inventory';
import { listStockByLocation } from '../../services/inventory/viewsService';
import { listWarehouses } from '../../services/inventory/warehousesService';

function fmtQty(value: number) {
  return new Intl.NumberFormat('es-DO', { maximumFractionDigits: 3 }).format(
    Number(value) || 0
  );
}

export default function StockByLocationPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<VStockByLocationRow[]>([]);
  const [warehouseId, setWarehouseId] = useState<UUID | ''>('');
  const [warehouses, setWarehouses] = useState<Array<{ id: UUID; label: string }>>(
    []
  );
  const [query, setQuery] = useState('');

  async function loadLookups() {
    try {
      const list = await listWarehouses({ limit: 500, is_active: true });
      setWarehouses(
        list.map((w) => ({ id: w.id, label: `${w.code} — ${w.name}` }))
      );
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('No se pudieron cargar los almacenes.');
    }
  }

  async function refresh() {
    setLoading(true);
    try {
      const data = await listStockByLocation(
        { warehouse_id: warehouseId || undefined },
        2000
      );
      setRows(data);
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('No se pudo cargar el stock por ubicación.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canRead) return;
    void loadLookups();
  }, [canRead]);

  useEffect(() => {
    if (!canRead) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, warehouseId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const haystack = [
        r.part_code,
        r.part_name,
        r.warehouse_code,
        r.warehouse_name,
        r.bin_code ?? '',
        r.bin_name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  if (!canRead) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No tienes permisos para acceder a inventario.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <div className="flex flex-col gap-3">
              <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                <Link to="/inventario" className="hover:text-slate-900">
                  Inventario
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-slate-900 font-medium">
                  Stock por ubicación
                </span>
              </nav>
              <div className="flex items-center gap-3">
                <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-sky-100">
                  <MapPinned className="h-5 w-5 text-sky-700" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-bold tracking-tight">
                    Stock por ubicación (bin)
                  </h1>
                  <p className="mt-1 text-xs md:text-sm text-slate-500">
                    Vista detallada por repuesto, almacén y bin.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="flex-1 min-h-0 overflow-auto bg-slate-100/60">
          <div className="px-4 md:px-6 lg:px-8 py-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Almacén
                  </label>
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    value={warehouseId}
                    onChange={(e) => setWarehouseId((e.target.value || '') as UUID | '')}
                  >
                    <option value="">Todos</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Buscar
                  </label>
                  <input
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="Código, nombre, almacén, bin..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Registros de stock
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {filtered.length} fila{filtered.length === 1 ? '' : 's'}
                </span>
              </div>

              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  Cargando stock por ubicación...
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No hay resultados para los filtros actuales.
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-semibold">Repuesto</th>
                          <th className="px-4 py-2.5 text-left font-semibold">Almacén</th>
                          <th className="px-4 py-2.5 text-left font-semibold">Bin</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
                          <th className="px-4 py-2.5 text-left font-semibold">Actualizado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filtered.map((r) => (
                          <tr key={`${r.part_id}:${r.warehouse_id}:${r.bin_id ?? 'null'}`}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{r.part_code}</div>
                              <div className="text-xs text-slate-500">{r.part_name}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {r.warehouse_code} — {r.warehouse_name}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {r.bin_code ? `${r.bin_code}${r.bin_name ? ` — ${r.bin_name}` : ''}` : 'Sin bin'}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                              {fmtQty(r.qty)}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {new Date(r.updated_at).toLocaleString('es-DO')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="divide-y divide-slate-200 md:hidden">
                    {filtered.map((r) => (
                      <article
                        key={`${r.part_id}:${r.warehouse_id}:${r.bin_id ?? 'null'}`}
                        className="px-4 py-3 space-y-2"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {r.part_code} — {r.part_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {r.warehouse_code} — {r.warehouse_name}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">
                              Bin
                            </p>
                            <p className="text-sm text-slate-800">
                              {r.bin_code
                                ? `${r.bin_code}${r.bin_name ? ` — ${r.bin_name}` : ''}`
                                : 'Sin bin'}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">
                              Qty
                            </p>
                            <p className="text-sm font-semibold text-slate-900">
                              {fmtQty(r.qty)}
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
        </section>
      </main>
    </div>
  );
}
