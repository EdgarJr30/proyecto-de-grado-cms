import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../rbac/PermissionsContext';
import {
  showConfirmAlert,
  showToastError,
  showToastSuccess,
} from '../../notifications';

import type {
  UUID,
  ReorderPolicyRow,
  ReorderPolicyInsert,
} from '../../types/inventory';
import {
  listReorderPolicies,
  upsertReorderPolicy,
  updateReorderPolicy,
  deleteReorderPolicy,
} from '../../services/inventory/reorderPoliciesService';

import type { OptionRow } from '../../services/inventory/lookupsService';
import {
  listWarehousesOptions,
  listVendorsOptions,
  listPartsOptions,
  listCategoriesOptions,
} from '../../services/inventory/lookupsService';

import ReorderPolicyModal, {
  type PolicyEditorState,
} from './ReorderPolicyModal';
import { MotionSpin } from '../../components/ui/motionPrimitives';
import {
  InventoryBottomPagination,
  InventoryTopPagination,
} from './components/InventoryPaginationNav';
import { InventoryFiltersDropdown } from './components/InventoryFiltersDropdown';
import { useClientPagination } from './components/useClientPagination';

import {
  Filter,
  Plus,
  RefreshCcw,
  Package,
  TrendingUp,
  AlertTriangle,
  Truck,
} from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const DEFAULT_EDITOR: PolicyEditorState = {
  mode: 'create',
  open: false,
  part_id: '',
  warehouse_id: '',
  min_qty: 0,
  max_qty: null,
  reorder_point: null,
  safety_stock: null,
  lead_time_days: null,
  preferred_vendor_id: null,
};

function fmtNum(v: number | null | undefined) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : '—';
}

function HeaderPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'info';
}) {
  const cls =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : tone === 'info'
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
        cls
      )}
    >
      {children}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  iconTone = 'bg-sky-500/10 text-sky-700 border-sky-500/20',
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  iconTone?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {label}
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value}
          </div>
          {sub ? (
            <div className="mt-1 text-xs text-slate-500">{sub}</div>
          ) : null}
        </div>
        <div
          className={cx(
            'h-10 w-10 rounded-xl border flex items-center justify-center',
            iconTone
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function ReorderPoliciesPage() {
  const perms = usePermissions();

  const canRead = perms.has('inventory:read');
  const canWrite = perms.has('inventory:full_access');

  const [loading, setLoading] = useState(false);

  // Filters
  const [warehouseId, setWarehouseId] = useState<UUID | ''>('');
  const [q, setQ] = useState('');

  // Data
  const [rows, setRows] = useState<ReorderPolicyRow[]>([]);

  // Lookups
  const [warehouses, setWarehouses] = useState<OptionRow[]>([]);
  const [vendors, setVendors] = useState<OptionRow[]>([]);
  const [categories, setCategories] = useState<OptionRow[]>([]);

  // Editor lookups
  const [partSearch, setPartSearch] = useState('');
  const [partCategoryId, setPartCategoryId] = useState<UUID | ''>('');
  const [parts, setParts] = useState<OptionRow[]>([]);

  const [editor, setEditor] = useState<PolicyEditorState>(DEFAULT_EDITOR);

  const navigate = useNavigate();

  async function loadLookups() {
    try {
      const [wh, vd, cats] = await Promise.all([
        listWarehousesOptions(),
        listVendorsOptions(),
        listCategoriesOptions(),
      ]);
      setWarehouses(wh);
      setVendors(vd);
      setCategories(cats);
    } catch (error: unknown) {
      showToastError(
        error instanceof Error ? error.message : 'Error cargando catálogos'
      );
    }
  }

  async function loadPartsOptions() {
    try {
      const data = await listPartsOptions({
        categoryId: partCategoryId || undefined,
        q: partSearch || undefined,
      });
      setParts(data);
    } catch (error: unknown) {
      showToastError(
        error instanceof Error ? error.message : 'Error cargando repuestos'
      );
    }
  }

  async function loadRows(next?: { warehouseId?: UUID | ''; query?: string }) {
    if (!canRead) return;

    setLoading(true);
    try {
      const appliedWarehouseId = next?.warehouseId ?? warehouseId;
      const appliedQuery = next?.query ?? q;
      const data = await listReorderPolicies(appliedWarehouseId || undefined);
      const needle = appliedQuery.trim().toLowerCase();
      const filtered =
        needle.length >= 2
          ? data.filter((r) => JSON.stringify(r).toLowerCase().includes(needle))
          : data;

      setRows(filtered);
    } catch (error: unknown) {
      showToastError(
        error instanceof Error ? error.message : 'Error cargando políticas'
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
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, canRead]);

  useEffect(() => {
    loadPartsOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partSearch, partCategoryId]);

  const whLabelById = useMemo(
    () => new Map(warehouses.map((w) => [w.id, w.label])),
    [warehouses]
  );
  const vendorLabelById = useMemo(
    () => new Map(vendors.map((v) => [v.id, v.label])),
    [vendors]
  );
  const partLabelById = useMemo(
    () => new Map(parts.map((p) => [p.id, p.label])),
    [parts]
  );

  // KPIs
  const kpis = useMemo(() => {
    const total = rows.length;
    const withMax = rows.filter((r) => r.max_qty !== null).length;
    const withVendor = rows.filter((r) => !!r.preferred_vendor_id).length;
    const withReorderPoint = rows.filter(
      (r) => r.reorder_point !== null
    ).length;
    return { total, withMax, withVendor, withReorderPoint };
  }, [rows]);
  const pagination = useClientPagination(rows, { initialPageSize: 50 });
  const visibleRows = pagination.pagedItems;

  function resetFilters() {
    setWarehouseId('');
    setQ('');
    void loadRows({ warehouseId: '', query: '' });
  }

  function openCreate() {
    setPartSearch('');
    setPartCategoryId('');
    setEditor({
      ...DEFAULT_EDITOR,
      open: true,
      mode: 'create',
      warehouse_id: warehouseId || '',
    });
  }

  function openEdit(r: ReorderPolicyRow) {
    setEditor({
      open: true,
      mode: 'edit',
      row: r,
      part_id: r.part_id,
      warehouse_id: r.warehouse_id,
      min_qty: Number(r.min_qty ?? 0),
      max_qty: r.max_qty === null ? null : Number(r.max_qty),
      reorder_point: r.reorder_point === null ? null : Number(r.reorder_point),
      safety_stock: r.safety_stock === null ? null : Number(r.safety_stock),
      lead_time_days:
        r.lead_time_days === null ? null : Number(r.lead_time_days),
      preferred_vendor_id: r.preferred_vendor_id ?? null,
    });
  }

  async function onSave() {
    if (!canWrite) return;

    try {
      if (!editor.part_id || !editor.warehouse_id) {
        showToastError('Selecciona repuesto y almacén');
        return;
      }

      setLoading(true);

      if (editor.mode === 'create') {
        const payload: ReorderPolicyInsert = {
          part_id: editor.part_id as UUID,
          warehouse_id: editor.warehouse_id as UUID,
          min_qty: editor.min_qty ?? 0,
          max_qty: editor.max_qty,
          reorder_point: editor.reorder_point,
          safety_stock: editor.safety_stock,
          lead_time_days: editor.lead_time_days,
          preferred_vendor_id: editor.preferred_vendor_id,
        };

        await upsertReorderPolicy(payload);
        showToastSuccess('Política creada/actualizada');
      } else {
        if (!editor.row) return;

        await updateReorderPolicy(editor.row.id, {
          min_qty: editor.min_qty ?? 0,
          max_qty: editor.max_qty,
          reorder_point: editor.reorder_point,
          safety_stock: editor.safety_stock,
          lead_time_days: editor.lead_time_days,
          preferred_vendor_id: editor.preferred_vendor_id,
        });

        showToastSuccess('Política actualizada');
      }

      setEditor(DEFAULT_EDITOR);
      await loadRows();
    } catch (error: unknown) {
      showToastError(
        error instanceof Error ? error.message : 'Error guardando política'
      );
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(r: ReorderPolicyRow) {
    if (!canWrite) return;
    const ok = await showConfirmAlert({
      title: 'Eliminar política',
      text: 'Se eliminará esta política de reposición. Esta acción no se puede deshacer.',
      confirmButtonText: 'Sí, eliminar',
    });
    if (!ok) return;

    setLoading(true);
    try {
      await deleteReorderPolicy(r.id);
      showToastSuccess('Política eliminada');
      await loadRows();
    } catch (error: unknown) {
      showToastError(
        error instanceof Error ? error.message : 'Error eliminando política'
      );
    } finally {
      setLoading(false);
    }
  }

  const editorTitle =
    editor.mode === 'create' ? 'Crear política de reposición' : 'Editar política de reposición';
  const editorSubtitle =
    'Único por (part_id, warehouse_id) — se hace upsert por esa llave.';

  if (!canRead) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900">
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No tienes permisos para acceder al módulo de políticas de reposición.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900">
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <section className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 lg:px-8 py-6">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <InventoryFiltersDropdown
                  icon={Filter}
                  title="Filtros y acciones"
                  description="Filtra políticas por almacén y búsqueda de texto libre."
                  searchValue={q}
                  searchPlaceholder="Filtra (>= 2 caracteres). Ej: bomba, 27, proveedor..."
                  onSearchChange={setQ}
                  onSearchSubmit={() => void loadRows()}
                  panelActions={
                    <>
                      <HeaderPill>
                        {loading ? 'Cargando…' : `${rows.length} registros`}
                      </HeaderPill>

                      {!canWrite ? (
                        <HeaderPill tone="warning">Solo lectura</HeaderPill>
                      ) : (
                        <HeaderPill tone="success">Escritura</HeaderPill>
                      )}

                      <button
                        onClick={() => void loadRows()}
                        className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        type="button"
                      >
                        Aplicar
                      </button>

                      <button
                        onClick={resetFilters}
                        className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        type="button"
                      >
                        Limpiar
                      </button>

                      <button
                        onClick={() => navigate('/inventory/reorder_suggestions')}
                        className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        type="button"
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Sugerencias
                      </button>

                      {canWrite ? (
                        <button
                          onClick={openCreate}
                          className="inline-flex items-center h-9 px-3 rounded-md bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
                          type="button"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Nueva política
                        </button>
                      ) : null}
                    </>
                  }
                  kpiWidgets={
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      <StatCard
                        label="Total políticas"
                        value={kpis.total}
                        sub="Según filtros aplicados"
                        icon={<Package className="h-5 w-5" />}
                        iconTone="bg-blue-50 text-blue-700 border-blue-200"
                      />
                      <StatCard
                        label="Con cantidad máx."
                        value={kpis.withMax}
                        sub="Control superior configurado"
                        icon={<TrendingUp className="h-5 w-5" />}
                        iconTone="bg-emerald-50 text-emerald-700 border-emerald-200"
                      />
                      <StatCard
                        label="Con punto de reposición"
                        value={kpis.withReorderPoint}
                        sub="Gatillo distinto a Min"
                        icon={<AlertTriangle className="h-5 w-5" />}
                        iconTone="bg-amber-50 text-amber-700 border-amber-200"
                      />
                      <StatCard
                        label="Con proveedor preferido"
                        value={kpis.withVendor}
                        sub="Sugerencia de compra"
                        icon={<Truck className="h-5 w-5" />}
                        iconTone="bg-indigo-50 text-indigo-700 border-indigo-200"
                      />
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
                    <div className="xl:col-span-3">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
                  </div>
                </InventoryFiltersDropdown>
              </div>

              <div className="px-4 py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">Listado</div>
                  <HeaderPill>
                    {warehouseId ? 'Almacén filtrado' : 'Todos los almacenes'}
                  </HeaderPill>
                  {q.trim().length >= 2 ? (
                    <HeaderPill tone="info">Búsqueda activa</HeaderPill>
                  ) : null}
                </div>

                <button
                  onClick={() => void loadRows()}
                  className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                >
                  {loading ? (
                    <MotionSpin className="inline-flex h-4 w-4 mr-2">
                      <RefreshCcw className="h-4 w-4" />
                    </MotionSpin>
                  ) : (
                    <RefreshCcw className="h-4 w-4 mr-2" />
                  )}
                  Refrescar
                </button>
              </div>

              <div className="px-4 py-3 border-b border-slate-100 bg-white">
                <InventoryTopPagination
                  isLoading={loading}
                  canPrev={pagination.canPrev}
                  canNext={pagination.canNext}
                  onPrev={pagination.goPrev}
                  onNext={pagination.goNext}
                />
              </div>

              <div className="overflow-auto">
                <table className="min-w-[1120px] w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-left text-xs text-slate-600">
                      <th className="p-4 font-semibold w-[360px]">Repuesto</th>
                      <th className="p-4 font-semibold w-[280px]">Almacén</th>
                      <th className="p-4 font-semibold text-right w-[110px]">Min</th>
                      <th className="p-4 font-semibold text-right w-[110px]">Max</th>
                      <th className="p-4 font-semibold text-right w-[130px]">
                        Reposición
                      </th>
                      <th className="p-4 font-semibold text-right w-[120px]">
                        Seguridad
                      </th>
                      <th className="p-4 font-semibold text-right w-[110px]">Plazo</th>
                      <th className="p-4 font-semibold w-[260px]">Proveedor</th>
                      <th className="p-4 font-semibold w-[180px] text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.map((r) => {
                      const hasReorderPoint = r.reorder_point !== null;
                      const partName = partLabelById.get(r.part_id) ?? r.part_id;
                      const whName = whLabelById.get(r.warehouse_id) ?? r.warehouse_id;
                      const vendorName = r.preferred_vendor_id
                        ? (vendorLabelById.get(r.preferred_vendor_id) ?? r.preferred_vendor_id)
                        : '—';

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/70">
                          <td className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate">
                                  {partName}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 font-mono truncate">
                                  {r.part_id}
                                </div>
                              </div>
                              <HeaderPill tone={hasReorderPoint ? 'info' : 'neutral'}>
                                {hasReorderPoint ? 'RP' : 'Min'}
                              </HeaderPill>
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {whName}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 font-mono truncate">
                                {r.warehouse_id}
                              </div>
                            </div>
                          </td>

                          <td className="p-4 text-right tabular-nums font-semibold text-slate-900">
                            {fmtNum(r.min_qty ?? 0)}
                          </td>

                          <td className="p-4 text-right tabular-nums text-slate-700">
                            {fmtNum(r.max_qty)}
                          </td>

                          <td className="p-4 text-right tabular-nums">
                            {r.reorder_point === null ? (
                              <span className="text-slate-500">—</span>
                            ) : (
                              <span className="font-semibold text-blue-700">
                                {fmtNum(r.reorder_point)}
                              </span>
                            )}
                          </td>

                          <td className="p-4 text-right tabular-nums text-slate-700">
                            {fmtNum(r.safety_stock)}
                          </td>

                          <td className="p-4 text-right tabular-nums text-slate-700">
                            {r.lead_time_days === null ? (
                              <span className="text-slate-500">—</span>
                            ) : (
                              <span className="font-semibold">{`${Number(r.lead_time_days)}d`}</span>
                            )}
                          </td>

                          <td className="p-4">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {r.preferred_vendor_id ? vendorName : '—'}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 font-mono truncate">
                                {r.preferred_vendor_id ?? '—'}
                              </div>
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="flex justify-end gap-2">
                              <button
                                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                onClick={() => openEdit(r)}
                                disabled={!canWrite}
                                type="button"
                              >
                                Editar
                              </button>
                              <button
                                className="h-9 px-3 rounded-md border border-rose-200 bg-white text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                onClick={() => void onDelete(r)}
                                disabled={!canWrite}
                                type="button"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {rows.length === 0 && !loading ? (
                      <tr>
                        <td className="p-10 text-center text-slate-500" colSpan={9}>
                          No hay registros para los filtros actuales.
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

              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div>
                  Consejo: usa <span className="font-mono">reorder_point</span> si
                  quieres un gatillo distinto a{' '}
                  <span className="font-mono">min_qty</span>.
                </div>
                <div className="flex items-center gap-2">
                  <HeaderPill>Encabezado fijo</HeaderPill>
                  <HeaderPill>Diseño ERP</HeaderPill>
                </div>
              </div>
            </div>
          </div>
        </section>

        <ReorderPolicyModal
          open={editor.open}
          title={editorTitle}
          subtitle={editorSubtitle}
          loading={loading}
          canWrite={canWrite}
          editor={editor}
          setEditor={setEditor}
          onClose={() => setEditor(DEFAULT_EDITOR)}
          onSave={onSave}
          warehouses={warehouses}
          vendors={vendors}
          categories={categories}
          parts={parts}
          partSearch={partSearch}
          setPartSearch={setPartSearch}
          partCategoryId={partCategoryId}
          setPartCategoryId={setPartCategoryId}
          partLabelById={partLabelById}
          warehouseLabelById={whLabelById}
        />
      </main>
    </div>
  );
}
