import { useEffect, useMemo, useState } from 'react';
import { usePermissions } from '../../rbac/PermissionsContext';
import { showToastError } from '../../notifications';

import type { UUID, VReorderSuggestionsRow } from '../../types/inventory';

import type { OptionRow } from '../../services/inventory/lookupsService';
import {
  listWarehousesOptions,
  listCategoriesOptions,
} from '../../services/inventory/lookupsService';
import {
  InventoryBottomPagination,
  InventoryTopPagination,
} from './components/InventoryPaginationNav';
import { InventoryFiltersDropdown } from './components/InventoryFiltersDropdown';
import { useClientPagination } from './components/useClientPagination';

import { listReorderSuggestions } from '../../services/inventory/reorderSuggestionsService';
import { Filter, RefreshCcw, RotateCcw, Search } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function fmtNum(v: number | string | null | undefined) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : '—';
}

export default function ReorderSuggestionsPage() {
  const perms = usePermissions();
  const canRead = perms.has('inventory:read');

  const [loading, setLoading] = useState(false);

  const [needsOnly, setNeedsOnly] = useState(true);
  const [warehouseId, setWarehouseId] = useState<UUID | ''>('');
  const [categoryId, setCategoryId] = useState<UUID | ''>('');
  const [q, setQ] = useState('');

  const [warehouses, setWarehouses] = useState<OptionRow[]>([]);
  const [categories, setCategories] = useState<OptionRow[]>([]);
  const [rows, setRows] = useState<VReorderSuggestionsRow[]>([]);

  async function loadLookups() {
    try {
      const [wh, cats] = await Promise.all([
        listWarehousesOptions(),
        listCategoriesOptions(),
      ]);
      setWarehouses(wh);
      setCategories(cats);
    } catch (e: unknown) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando catálogos'
      );
    }
  }

  async function load(next?: { query?: string }) {
    if (!canRead) return;

    setLoading(true);
    try {
      const query = next?.query ?? q;
      const data = await listReorderSuggestions({
        needsReorder: needsOnly,
        warehouseId: warehouseId || undefined,
        categoryId: categoryId || undefined,
        q: query.trim() || undefined,
      });
      setRows(data);
    } catch (e: unknown) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando sugerencias'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOnly, warehouseId, categoryId, canRead]);

  const needsCount = useMemo(
    () => rows.filter((r) => r.needs_reorder).length,
    [rows]
  );
  const pagination = useClientPagination(rows, { initialPageSize: 50 });
  const visibleRows = pagination.pagedItems;

  function resetFilters() {
    setNeedsOnly(true);
    setWarehouseId('');
    setCategoryId('');
    setQ('');
    void load({ query: '' });
  }

  // ✅ Guard de permisos para evitar "pantalla en blanco"
  if (!canRead) {
    return (
      <div className="h-screen flex bg-background text-foreground">
        <main className="flex-1 min-w-0 p-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="text-lg font-semibold">Sin acceso</div>
            <p className="mt-1 text-sm text-muted-foreground">
              No tienes permiso{' '}
              <span className="font-mono">inventory:read</span> para ver las
              sugerencias de reposición.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background text-foreground">
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto pt-6">
          <div className="px-4 md:px-6 py-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <InventoryFiltersDropdown
                icon={Filter}
                title="Filtros y acciones"
                description="Filtra sugerencias por almacén, categoría y texto de búsqueda."
                searchValue={q}
                searchPlaceholder="Buscar por código o nombre de repuesto..."
                onSearchChange={setQ}
                onSearchSubmit={() => void load()}
                panelActions={
                  <>
                    <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {loading
                        ? 'Cargando…'
                        : `${rows.length} filas / necesitan=${needsCount}`}
                    </span>
                    <button
                      onClick={() => void load()}
                      className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      type="button"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Aplicar
                    </button>
                    <button
                      onClick={() => void load()}
                      className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      type="button"
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Recargar
                    </button>
                    <button
                      onClick={resetFilters}
                      className="inline-flex items-center h-9 px-3 rounded-md bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700"
                      type="button"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reiniciar
                    </button>
                  </>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Requiere reposición
                    </label>
                    <div className="mt-1 flex gap-2">
                      <button
                        onClick={() => setNeedsOnly(true)}
                        className={cx(
                          'h-10 px-3 rounded-md border text-sm font-semibold',
                          needsOnly
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        )}
                        type="button"
                      >
                        Solo necesarios
                      </button>
                      <button
                        onClick={() => setNeedsOnly(false)}
                        className={cx(
                          'h-10 px-3 rounded-md border text-sm font-semibold',
                          !needsOnly
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        )}
                        type="button"
                      >
                        Todos
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Almacén
                    </label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={warehouseId}
                      onChange={(e) =>
                        setWarehouseId((e.target.value as UUID) || '')
                      }
                    >
                      <option value="">Todos</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Categoría
                    </label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={categoryId}
                      onChange={(e) =>
                        setCategoryId((e.target.value as UUID) || '')
                      }
                    >
                      <option value="">Todas</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </InventoryFiltersDropdown>
            </div>

            {/* Table */}
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="text-sm font-semibold">
                  Resultados{' '}
                  <span className="text-xs text-muted-foreground">
                    (
                    {loading
                      ? 'Cargando…'
                      : `${rows.length} / necesitan=${needsCount}`}
                    )
                  </span>
                </div>
              </div>

              <div className="px-4 py-3 border-b">
                <InventoryTopPagination
                  isLoading={loading}
                  canPrev={pagination.canPrev}
                  canNext={pagination.canNext}
                  onPrev={pagination.goPrev}
                  onNext={pagination.goNext}
                />
              </div>

              <div className="overflow-auto">
                <table className="min-w-[1060px] w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="p-4 font-semibold">Repuesto</th>
                      <th className="p-4 font-semibold">Almacén</th>
                      <th className="p-4 font-semibold text-right">
                        En existencia
                      </th>
                      <th className="p-4 font-semibold text-right">Min</th>
                      <th className="p-4 font-semibold text-right">
                        Punto de reposición
                      </th>
                      <th className="p-4 font-semibold text-right">
                        Reposición sugerida
                      </th>
                      <th className="p-4 font-semibold">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {visibleRows.map((r) => (
                      <tr
                        key={`${r.part_id}-${r.warehouse_id}`}
                        className="hover:bg-muted/20"
                      >
                        <td className="p-4">
                          <div className="font-mono text-xs text-muted-foreground">
                            {r.part_code}
                          </div>
                          <div className="text-sm font-semibold">
                            {r.part_name}
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="font-mono text-xs text-muted-foreground">
                            {r.warehouse_code}
                          </div>
                          <div className="text-sm font-semibold">
                            {r.warehouse_name}
                          </div>
                        </td>

                        <td className="p-4 text-right tabular-nums">
                          {fmtNum(r.on_hand_qty)}
                        </td>

                        <td className="p-4 text-right tabular-nums">
                          {fmtNum(r.min_qty)}
                        </td>

                        <td className="p-4 text-right tabular-nums">
                          {r.reorder_point === null
                            ? '—'
                            : fmtNum(r.reorder_point)}
                        </td>

                        <td className="p-4 text-right tabular-nums font-semibold">
                          {fmtNum(r.suggested_min_replenish)}
                        </td>

                        <td className="p-4">
                          <span
                            className={cx(
                              'inline-flex items-center px-2 py-1 rounded-full text-xs border font-semibold',
                              r.needs_reorder
                                ? 'bg-red-500/10 border-red-500/30'
                                : 'bg-emerald-500/10 border-emerald-500/30'
                            )}
                          >
                            {r.needs_reorder ? 'Requiere reposición' : 'OK'}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {rows.length === 0 && !loading ? (
                      <tr>
                        <td
                          className="p-10 text-center text-muted-foreground"
                          colSpan={7}
                        >
                          No hay resultados con esos filtros.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <InventoryBottomPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalCount={pagination.totalCount}
                rangeStart={pagination.rangeStart}
                rangeEnd={pagination.rangeEnd}
                isLoading={loading}
                canPrev={pagination.canPrev}
                canNext={pagination.canNext}
                onPrev={pagination.goPrev}
                onNext={pagination.goNext}
              />

              <div className="px-4 py-3 border-t text-xs text-muted-foreground">
                Consejo: la “reposición sugerida” normalmente busca llevarte al
                mínimo (u objetivo) según tu vista de sugerencias.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
