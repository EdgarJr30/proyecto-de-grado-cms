import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { usePermissions } from '../../rbac/PermissionsContext';
import { showToastError } from '../../notifications';

import type { UUID, VReorderSuggestionsRow } from '../../types/inventory';

import type { OptionRow } from '../../services/inventory/lookupsService';
import {
  listWarehousesOptions,
  listCategoriesOptions,
} from '../../services/inventory/lookupsService';

import { listReorderSuggestions } from '../../services/inventory/reorderSuggestionsService';

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

  async function load() {
    if (!canRead) return;

    setLoading(true);
    try {
      const data = await listReorderSuggestions({
        needsReorder: needsOnly,
        warehouseId: warehouseId || undefined,
        categoryId: categoryId || undefined,
        q: q.trim() || undefined,
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

  // ✅ Guard de permisos para evitar "pantalla en blanco"
  if (!canRead) {
    return (
      <div className="h-screen flex bg-background text-foreground">
        <Sidebar />
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
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        {/* Header */}
        <div className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="px-4 md:px-6 pt-5 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Inventario
                  </span>
                  <span className="text-xs text-muted-foreground">›</span>
                  <span className="text-xs text-muted-foreground">
                    Reposición
                  </span>
                  <span className="text-xs text-muted-foreground">›</span>
                  <span className="text-xs font-semibold text-foreground/80">
                    Reorder Suggestions
                  </span>
                </div>

                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  Reorder Suggestions
                </h1>
                <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
                  Vista <span className="font-mono">v_reorder_suggestions</span>{' '}
                  — solo lectura. Aquí se muestran las sugerencias de reposición
                  calculadas según stock y políticas (min/reorder_point).
                </p>
              </div>

              <div className="shrink-0 text-xs text-muted-foreground">
                {loading
                  ? 'Cargando…'
                  : `${rows.length} filas / needs=${needsCount}`}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 py-4 space-y-4">
            {/* Filters */}
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="rounded-xl border p-3 bg-card">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Needs reorder
                  </label>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setNeedsOnly(true)}
                      className={cx(
                        'px-3 py-2 rounded-xl border text-sm font-semibold',
                        needsOnly && 'bg-accent'
                      )}
                      type="button"
                    >
                      Solo necesarios
                    </button>
                    <button
                      onClick={() => setNeedsOnly(false)}
                      className={cx(
                        'px-3 py-2 rounded-xl border text-sm font-semibold',
                        !needsOnly && 'bg-accent'
                      )}
                      type="button"
                    >
                      Todos
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border p-3 bg-card">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Warehouse
                  </label>
                  <select
                    className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
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

                <div className="rounded-xl border p-3 bg-card">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Categoría
                  </label>
                  <select
                    className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
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

                <div className="rounded-xl border p-3 bg-card">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Buscar (code/name)
                  </label>
                  <input
                    className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') load();
                    }}
                    placeholder="Ej: FILTRO, BANDA, 10W40…"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={load}
                      className="px-3 py-2 rounded-xl border text-sm font-semibold hover:bg-accent"
                      type="button"
                    >
                      Aplicar
                    </button>
                    <button
                      onClick={() => {
                        setQ('');
                        load();
                      }}
                      className="px-3 py-2 rounded-xl border text-sm font-semibold hover:bg-accent"
                      type="button"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              </div>
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
                      : `${rows.length} / needs=${needsCount}`}
                    )
                  </span>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="min-w-[1060px] w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="p-4 font-semibold">Part</th>
                      <th className="p-4 font-semibold">Warehouse</th>
                      <th className="p-4 font-semibold text-right">On hand</th>
                      <th className="p-4 font-semibold text-right">Min</th>
                      <th className="p-4 font-semibold text-right">
                        Reorder point
                      </th>
                      <th className="p-4 font-semibold text-right">
                        Suggested replenish
                      </th>
                      <th className="p-4 font-semibold">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {rows.map((r) => (
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
                            {r.needs_reorder ? 'Needs reorder' : 'OK'}
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

              <div className="px-4 py-3 border-t text-xs text-muted-foreground">
                Consejo: “Suggested replenish” normalmente busca llevarte al
                mínimo (o al target) según tu vista de sugerencias.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
