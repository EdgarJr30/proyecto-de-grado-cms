import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePermissions } from '../../rbac/PermissionsContext';
import {
  showConfirmAlert,
  showToastError,
  showToastSuccess,
} from '../../notifications';
import type {
  UUID,
  WarehouseBinInsert,
  WarehouseBinRow,
  WarehouseBinUpdate,
  WarehouseRow,
} from '../../types/inventory';
import {
  createWarehouseBin,
  deleteWarehouseBin,
  listWarehouseBins,
  listWarehouses,
  updateWarehouseBin,
} from '../../services/inventory';
import AnimatedDialog from '../../components/ui/AnimatedDialog';
import {
  InventoryBottomPagination,
  InventoryTopPagination,
} from './components/InventoryPaginationNav';
import { useClientPagination } from './components/useClientPagination';
import { InventoryFiltersDropdown } from './components/InventoryFiltersDropdown';
import {
  Boxes,
  ChevronLeft,
  Filter,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Pencil,
} from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
}

type FormState = {
  code: string;
  name: string;
  is_active: boolean;
};

function toFormDefaults(b?: WarehouseBinRow): FormState {
  return {
    code: b?.code ?? '',
    name: b?.name ?? '',
    is_active: b?.is_active ?? true,
  };
}

export default function WarehouseBinsPage() {
  const { warehouseId } = useParams<{ warehouseId: UUID }>();
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canWrite = has('inventory:full_access');

  const checkboxRef = useRef<HTMLInputElement>(null);

  const [warehouse, setWarehouse] = useState<WarehouseRow | null>(null);
  const [rows, setRows] = useState<WarehouseBinRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    'active'
  );

  const [selectedRows, setSelectedRows] = useState<WarehouseBinRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseBinRow | null>(null);
  const [form, setForm] = useState<FormState>(() => toFormDefaults());
  const [saving, setSaving] = useState(false);

  async function loadWarehouse() {
    if (!warehouseId) return;
    try {
      const all = await listWarehouses({
        limit: 500,
        orderBy: 'code',
        ascending: true,
      });
      const w = all.find((x) => x.id === warehouseId) ?? null;
      setWarehouse(w);
    } catch (error: unknown) {
      console.warn(getErrorMessage(error));
    }
  }

  async function refreshBins() {
    if (!warehouseId) return;
    setLoading(true);
    try {
      const data = await listWarehouseBins(warehouseId, {
        limit: 1000,
        orderBy: 'code',
        ascending: true,
      });
      setRows(data);
      setSelectedRows([]);
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWarehouse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  useEffect(() => {
    void refreshBins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !q ||
        row.code.toLowerCase().includes(q) ||
        (row.name ?? '').toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? row.is_active
            : !row.is_active;
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  const pagination = useClientPagination(filtered, { initialPageSize: 50 });
  const visibleRows = pagination.pagedItems;

  useEffect(() => {
    setSelectedRows((prev) => prev.filter((row) => visibleRows.includes(row)));
  }, [visibleRows]);

  useEffect(() => {
    const total = visibleRows.length;
    const selected = selectedRows.length;

    const nextChecked = total > 0 && selected === total;
    const nextInd = selected > 0 && selected < total;

    setChecked(nextChecked);
    setIndeterminate(nextInd);

    if (checkboxRef.current) checkboxRef.current.indeterminate = nextInd;
  }, [visibleRows.length, selectedRows.length]);

  function toggleAll() {
    const shouldSelectAll = !(checked || indeterminate);
    setSelectedRows(shouldSelectAll ? visibleRows : []);
    setChecked(shouldSelectAll);
    setIndeterminate(false);
    if (checkboxRef.current) checkboxRef.current.indeterminate = false;
  }

  function openCreate() {
    if (!canWrite) {
      showToastError('No tienes permisos para gestionar ubicaciones.');
      return;
    }
    setEditing(null);
    setForm(toFormDefaults());
    setIsModalOpen(true);
  }

  function openEdit(bin: WarehouseBinRow) {
    if (!canWrite) {
      showToastError('No tienes permisos para gestionar ubicaciones.');
      return;
    }
    setEditing(bin);
    setForm(toFormDefaults(bin));
    setIsModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setIsModalOpen(false);
  }

  useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, saving]);

  async function onSave() {
    if (!warehouseId || !canWrite) return;

    const code = form.code.trim();
    if (!code) {
      showToastError('El código es requerido.');
      return;
    }

    setSaving(true);
    try {
      if (!editing) {
        const payload: WarehouseBinInsert = {
          warehouse_id: warehouseId,
          code,
          name: form.name.trim() || null,
          is_active: form.is_active,
        };
        await createWarehouseBin(payload);
        showToastSuccess('Ubicación creada');
      } else {
        const patch: WarehouseBinUpdate = {
          code,
          name: form.name.trim() || null,
          is_active: form.is_active,
        };
        await updateWarehouseBin(editing.id, patch);
        showToastSuccess('Ubicación actualizada');
      }

      setIsModalOpen(false);
      await refreshBins();
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: WarehouseBinRow) {
    if (!canWrite) {
      showToastError('No tienes permisos para gestionar ubicaciones.');
      return;
    }

    const ok = await showConfirmAlert({
      title: 'Eliminar ubicación',
      text: `¿Eliminar la ubicación "${row.code}"? La acción puede fallar si existe inventario asociado.`,
      confirmButtonText: 'Sí, eliminar',
    });
    if (!ok) return;

    try {
      await deleteWarehouseBin(row.id);
      showToastSuccess('Ubicación eliminada');
      await refreshBins();
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    }
  }

  async function onBulkDelete() {
    if (!canWrite) {
      showToastError('No tienes permisos para gestionar ubicaciones.');
      return;
    }
    if (selectedRows.length === 0) return;

    const ok = await showConfirmAlert({
      title: 'Eliminar selección',
      text: `¿Eliminar ${selectedRows.length} ubicación(es) seleccionada(s)?`,
      confirmButtonText: 'Sí, eliminar',
    });
    if (!ok) return;

    try {
      for (const row of selectedRows) {
        await deleteWarehouseBin(row.id);
      }
      showToastSuccess(`Se eliminaron ${selectedRows.length} ubicación(es).`);
      await refreshBins();
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    }
  }

  if (!canRead) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900">
        <main className="flex-1 h-[100dvh] overflow-hidden">
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No tienes permisos para acceder a ubicaciones.
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!warehouseId) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900">
        <main className="flex-1 h-[100dvh] overflow-hidden">
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Falta el ID de almacén en la ruta.
            </div>
          </div>
        </main>
      </div>
    );
  }

  const warehouseLabel = warehouse
    ? `${warehouse.code} - ${warehouse.name}`
    : 'Ubicaciones por almacén';

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900">
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <section className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 lg:px-8 py-6">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <div className="text-xs text-slate-500 mb-3">Almacén: {warehouseLabel}</div>
                <InventoryFiltersDropdown
                  icon={Filter}
                  title="Filtros y acciones"
                  description="Filtra ubicaciones por código, nombre y estado."
                  searchValue={query}
                  searchPlaceholder="Código o nombre de ubicación..."
                  onSearchChange={setQuery}
                  panelActions={
                    <>
                      <Link
                        to="/inventory/warehouses"
                        className="inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Almacenes
                      </Link>
                      <button
                        type="button"
                        onClick={() => void refreshBins()}
                        disabled={loading}
                        className={cx(
                          'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border',
                          loading
                            ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        )}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refrescar
                      </button>
                      <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        <Boxes className="h-3.5 w-3.5 text-blue-700" />
                        {filtered.length} items
                      </span>
                      {selectedRows.length > 0 ? (
                        <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {selectedRows.length} seleccionadas
                        </span>
                      ) : null}
                      {!canWrite ? (
                        <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Solo lectura
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={openCreate}
                        disabled={!canWrite}
                        className={cx(
                          'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                          !canWrite
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        )}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo
                      </button>
                      <button
                        type="button"
                        onClick={() => void onBulkDelete()}
                        disabled={!canWrite || loading || selectedRows.length === 0}
                        className={cx(
                          'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                          !canWrite || loading || selectedRows.length === 0
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-rose-600 hover:bg-rose-700 text-white'
                        )}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar selección
                      </button>
                    </>
                  }
                >
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700">
                      Estado
                    </label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value as 'all' | 'active' | 'inactive'
                        )
                      }
                    >
                      <option value="all">Todos</option>
                      <option value="active">Activos</option>
                      <option value="inactive">Inactivos</option>
                    </select>
                  </div>
                </InventoryFiltersDropdown>
              </div>

              <div className="px-5 py-3 border-b border-slate-100 bg-white">
                <InventoryTopPagination
                  isLoading={loading}
                  canPrev={pagination.canPrev}
                  canNext={pagination.canNext}
                  onPrev={pagination.goPrev}
                  onNext={pagination.goNext}
                />
              </div>

              <div className="md:hidden p-4 space-y-3">
                {loading ? (
                  <div className="py-10 text-center text-slate-400">Cargando...</div>
                ) : filtered.length === 0 ? (
                  <div className="py-10 text-center text-slate-400">Sin resultados.</div>
                ) : (
                  visibleRows.map((row) => {
                    const selected = selectedRows.includes(row);
                    return (
                      <div
                        key={row.id}
                        className={cx(
                          'rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
                          selected && 'ring-2 ring-blue-500/20'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            checked={selected}
                            disabled={!canWrite}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedRows((prev) => [...prev, row]);
                                return;
                              }
                              setSelectedRows((prev) =>
                                prev.filter((item) => item !== row)
                              );
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-900">{row.code}</div>
                            <div className="mt-1 text-xs text-slate-600">{row.name ?? 'Sin nombre'}</div>
                            <div className="mt-2">
                              {row.is_active ? (
                                <span className="inline-flex px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                                  Activo
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                                  Inactivo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            className={cx(
                              'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border',
                              !canWrite
                                ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                            )}
                            disabled={!canWrite}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </button>
                          <button
                            type="button"
                            className={cx(
                              'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                              !canWrite
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-rose-600 hover:bg-rose-700 text-white'
                            )}
                            disabled={!canWrite}
                            onClick={() => void onDelete(row)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white sticky top-0 z-10">
                    <tr className="border-b border-slate-200">
                      <th className="px-5 py-3 w-12">
                        <input
                          ref={checkboxRef}
                          type="checkbox"
                          disabled={!canWrite || visibleRows.length === 0 || loading}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                          checked={checked}
                          onChange={toggleAll}
                          aria-label="Seleccionar todo"
                        />
                      </th>
                      <th className="text-left font-semibold text-slate-600 px-5 py-3">Código</th>
                      <th className="text-left font-semibold text-slate-600 px-5 py-3">Nombre</th>
                      <th className="text-left font-semibold text-slate-600 px-5 py-3">Estado</th>
                      <th className="text-right font-semibold text-slate-600 px-5 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400">
                          Cargando...
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400">
                          Sin resultados.
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((row) => {
                        const selected = selectedRows.includes(row);
                        return (
                          <tr
                            key={row.id}
                            className={cx(
                              'hover:bg-slate-50/70 transition',
                              selected && 'bg-blue-50/50'
                            )}
                          >
                            <td className="px-5 py-3 w-12">
                              <input
                                type="checkbox"
                                disabled={!canWrite}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                checked={selected}
                                onChange={(event) => {
                                  if (event.target.checked) {
                                    setSelectedRows((prev) => [...prev, row]);
                                    return;
                                  }
                                  setSelectedRows((prev) =>
                                    prev.filter((item) => item !== row)
                                  );
                                }}
                              />
                            </td>
                            <td className="px-5 py-3 font-mono font-semibold text-slate-900">{row.code}</td>
                            <td className="px-5 py-3 text-slate-700">{row.name ?? '—'}</td>
                            <td className="px-5 py-3">
                              {row.is_active ? (
                                <span className="inline-flex px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                                  Activo
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                                  Inactivo
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className={cx(
                                    'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border',
                                    !canWrite
                                      ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                  )}
                                  disabled={!canWrite}
                                  onClick={() => openEdit(row)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className={cx(
                                    'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                                    !canWrite
                                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                                  )}
                                  disabled={!canWrite}
                                  onClick={() => void onDelete(row)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
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

              <div className="px-5 py-4 border-t border-slate-100 bg-white">
                <div className="text-xs text-slate-500">
                  Tip: usa códigos cortos y únicos por almacén para localizar
                  rápido pasillos y estantes.
                </div>
              </div>
            </div>
          </div>
        </section>

        {isModalOpen && (
          <AnimatedDialog
            open
            onClose={closeModal}
            overlayClassName="bg-black/30"
            panelClassName="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="h-10 border-b border-slate-200 bg-blue-50/60" />

            <div className="p-5 -mt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {editing ? 'Editar ubicación' : 'Nueva ubicación'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    El código debe ser único por almacén.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  aria-label="Cerrar"
                  title="Cerrar"
                >
                  x
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="font-semibold text-slate-700">Código</span>
                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, code: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>

                <label className="text-sm">
                  <span className="font-semibold text-slate-700">Nombre (opcional)</span>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, name: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, is_active: e.target.checked }))
                    }
                  />
                  Activo
                </label>
              </div>

              <div className="pt-5 flex justify-end gap-2">
                <button
                  onClick={closeModal}
                  className="inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  disabled={!canWrite || saving}
                  onClick={() => void onSave()}
                  className={cx(
                    'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                    !canWrite || saving
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  )}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </AnimatedDialog>
        )}
      </main>
    </div>
  );
}
