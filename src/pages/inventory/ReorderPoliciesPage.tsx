import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
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

import {
  Filter,
  Plus,
  RefreshCcw,
  Package,
  TrendingUp,
  AlertTriangle,
  Truck,
  Search,
  ChevronDown,
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
      ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
      : tone === 'warning'
        ? 'bg-amber-500/10 text-amber-800 border-amber-500/20'
        : tone === 'info'
          ? 'bg-sky-500/10 text-sky-700 border-sky-500/20'
          : 'bg-muted/40 text-foreground/70 border-border';
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
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {label}
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">
            {value}
          </div>
          {sub ? (
            <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
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
  const [filtersOpen, setFiltersOpen] = useState(true);

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

  async function loadRows() {
    if (!canRead) return;

    setLoading(true);
    try {
      const data = await listReorderPolicies(warehouseId || undefined);
      const needle = q.trim().toLowerCase();
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

  const pageTitle = 'Políticas de reposición';
  const pageSubtitle =
    'Define mínimos/máximos y gatillos de reposición por repuesto y almacén para compras y disponibilidad.';

  const editorTitle =
    editor.mode === 'create' ? 'Crear política de reposición' : 'Editar política de reposición';
  const editorSubtitle =
    'Único por (part_id, warehouse_id) — se hace upsert por esa llave.';

  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        {/* Top Bar */}
        <div className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="px-4 md:px-6 pt-5 pb-4">
            <div className="flex flex-col gap-4">
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
                      {pageTitle}
                    </span>
                  </div>

                  <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                    {pageTitle}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
                    {pageSubtitle}
                  </p>
                </div>

                {/* Actions (como la imagen) */}
                <div className="flex items-center gap-2 shrink-0">
                  <HeaderPill>
                    {loading ? 'Cargando…' : `${rows.length} registros`}
                  </HeaderPill>
                  {!canWrite ? (
                    <HeaderPill tone="warning">Solo lectura</HeaderPill>
                  ) : (
                    <HeaderPill tone="success">Escritura</HeaderPill>
                  )}

                  <button
                    onClick={() => navigate('/inventory/reorder_suggestions')}
                    className={cx(
                      'inline-flex items-center gap-2 justify-center',
                      'h-10 px-3 rounded-xl border text-sm font-medium',
                      'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/30'
                    )}
                    type="button"
                  >
                    <TrendingUp className="h-4 w-4" />
                    Sugerencias
                  </button>

                  <button
                    className={cx(
                      'inline-flex items-center gap-2 justify-center',
                      'h-10 px-3 rounded-xl border text-sm font-medium',
                      'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/30'
                    )}
                    onClick={() => setFiltersOpen((v) => !v)}
                    type="button"
                  >
                    <Filter className="h-4 w-4" />
                    Filtros
                    <ChevronDown
                      className={cx(
                        'h-4 w-4 transition-transform',
                        filtersOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {canWrite && (
                    <button
                      onClick={openCreate}
                      className={cx(
                        'inline-flex items-center gap-2 justify-center',
                        'h-10 px-4 rounded-xl text-sm font-semibold',
                        'bg-primary text-primary-foreground hover:opacity-90',
                        'focus:outline-none focus:ring-2 focus:ring-primary/30'
                      )}
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                      Nueva política
                    </button>
                  )}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard
                  label="Total políticas"
                  value={kpis.total}
                  sub="Según filtros aplicados"
                  icon={<Package className="h-5 w-5" />}
                  iconTone="bg-sky-500/10 text-sky-700 border-sky-500/20"
                />
                <StatCard
                  label="Con cantidad máx."
                  value={kpis.withMax}
                  sub="Control superior configurado"
                  icon={<TrendingUp className="h-5 w-5" />}
                  iconTone="bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                />
                <StatCard
                  label="Con punto de reposición"
                  value={kpis.withReorderPoint}
                  sub="Gatillo distinto a Min"
                  icon={<AlertTriangle className="h-5 w-5" />}
                  iconTone="bg-amber-500/10 text-amber-800 border-amber-500/20"
                />
                <StatCard
                  label="Con proveedor preferido"
                  value={kpis.withVendor}
                  sub="Sugerencia de compra"
                  icon={<Truck className="h-5 w-5" />}
                  iconTone="bg-indigo-500/10 text-indigo-700 border-indigo-500/20"
                />
              </div>

              {/* Filters Panel (layout como screenshot) */}
              {filtersOpen ? (
                <div className="rounded-2xl border bg-card p-4 shadow-sm">
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-end">
                    <div className="xl:col-span-3">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Almacén
                      </label>
                      <select
                        className={cx(
                          'mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-primary/30'
                        )}
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

                    <div className="xl:col-span-9">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Búsqueda
                      </label>
                      <div className="mt-1 flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <input
                            className={cx(
                              'w-full rounded-xl border bg-background pl-9 pr-3 py-2.5 text-sm',
                              'focus:outline-none focus:ring-2 focus:ring-primary/30'
                            )}
                            placeholder="Filtra (>= 2 caracteres). Ej: bomba, 27, proveedor..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') loadRows();
                            }}
                          />
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={loadRows}
                            className={cx(
                              'h-11 px-4 rounded-xl border text-sm font-semibold',
                              'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/30'
                            )}
                            type="button"
                          >
                            Aplicar
                          </button>
                          <button
                            onClick={() => {
                              setQ('');
                              loadRows();
                            }}
                            className={cx(
                              'h-11 px-4 rounded-xl border text-sm font-semibold',
                              'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/30'
                            )}
                            type="button"
                          >
                            Limpiar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 py-4">
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              {/* Table toolbar */}
              <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">Listado</div>
                  <HeaderPill>
                    {warehouseId
                      ? 'Almacén filtrado'
                      : 'Todos los almacenes'}
                  </HeaderPill>
                  {q.trim().length >= 2 ? (
                    <HeaderPill tone="info">Búsqueda activa</HeaderPill>
                  ) : null}
                </div>

                <button
                  onClick={loadRows}
                  className={cx(
                    'inline-flex items-center gap-2 justify-center',
                    'h-10 px-3 rounded-xl border text-sm font-semibold',
                    'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/30'
                  )}
                  type="button"
                >
                  <RefreshCcw
                    className={cx('h-4 w-4', loading && 'animate-spin')}
                  />
                  Refrescar
                </button>
              </div>

              {/* Table */}
              <div className="overflow-auto">
                <table className="min-w-[1120px] w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="p-4 font-semibold w-[360px]">Repuesto</th>
                      <th className="p-4 font-semibold w-[280px]">Almacén</th>
                      <th className="p-4 font-semibold text-right w-[110px]">
                        Min
                      </th>
                      <th className="p-4 font-semibold text-right w-[110px]">
                        Max
                      </th>
                      <th className="p-4 font-semibold text-right w-[130px]">
                        Reposición
                      </th>
                      <th className="p-4 font-semibold text-right w-[120px]">
                        Seguridad
                      </th>
                      <th className="p-4 font-semibold text-right w-[110px]">
                        Plazo
                      </th>
                      <th className="p-4 font-semibold w-[260px]">Proveedor</th>
                      <th className="p-4 font-semibold w-[180px] text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {rows.map((r) => {
                      const hasReorderPoint = r.reorder_point !== null;

                      const partName = partLabelById.get(r.part_id) ?? '—';
                      const whName = whLabelById.get(r.warehouse_id) ?? '—';
                      const vendorName = r.preferred_vendor_id
                        ? (vendorLabelById.get(r.preferred_vendor_id) ?? '—')
                        : '—';

                      return (
                        <tr key={r.id} className="hover:bg-muted/20">
                          <td className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">
                                  {partName}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                                  {r.part_id}
                                </div>
                              </div>
                              <HeaderPill
                                tone={hasReorderPoint ? 'info' : 'neutral'}
                              >
                                {hasReorderPoint ? 'RP' : 'Min'}
                              </HeaderPill>
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">
                                {whName}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                                {r.warehouse_id}
                              </div>
                            </div>
                          </td>

                          <td className="p-4 text-right tabular-nums font-semibold">
                            {fmtNum(r.min_qty ?? 0)}
                          </td>

                          <td className="p-4 text-right tabular-nums text-foreground/80">
                            {fmtNum(r.max_qty)}
                          </td>

                          <td className="p-4 text-right tabular-nums">
                            {r.reorder_point === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="font-semibold text-sky-700">
                                {fmtNum(r.reorder_point)}
                              </span>
                            )}
                          </td>

                          <td className="p-4 text-right tabular-nums text-foreground/80">
                            {fmtNum(r.safety_stock)}
                          </td>

                          <td className="p-4 text-right tabular-nums text-foreground/80">
                            {r.lead_time_days === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="font-semibold">{`${Number(r.lead_time_days)}d`}</span>
                            )}
                          </td>

                          <td className="p-4">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">
                                {r.preferred_vendor_id ? vendorName : '—'}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                                {r.preferred_vendor_id ?? '—'}
                              </div>
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="flex justify-end gap-2">
                              <button
                                className={cx(
                                  'h-10 px-4 rounded-xl border text-sm font-semibold',
                                  'hover:bg-accent disabled:opacity-50',
                                  'focus:outline-none focus:ring-2 focus:ring-primary/30'
                                )}
                                onClick={() => openEdit(r)}
                                disabled={!canWrite}
                                type="button"
                              >
                                Editar
                              </button>
                              <button
                                className={cx(
                                  'h-10 px-4 rounded-xl border text-sm font-semibold',
                                  'hover:bg-accent disabled:opacity-50',
                                  'focus:outline-none focus:ring-2 focus:ring-primary/30'
                                )}
                                onClick={() => onDelete(r)}
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
                        <td
                          className="p-10 text-center text-muted-foreground"
                          colSpan={9}
                        >
                          No hay registros para los filtros actuales.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                <div>
                  Consejo: usa <span className="font-mono">reorder_point</span>{' '}
                  si quieres un gatillo distinto a{' '}
                  <span className="font-mono">min_qty</span>.
                </div>
                <div className="flex items-center gap-2">
                  <HeaderPill>Encabezado fijo</HeaderPill>
                  <HeaderPill>Diseño ERP</HeaderPill>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal separado (diseño igual a la imagen) */}
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
