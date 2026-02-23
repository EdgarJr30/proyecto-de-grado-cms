import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
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

  const [warehouse, setWarehouse] = useState<WarehouseRow | null>(null);
  const [rows, setRows] = useState<WarehouseBinRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

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
      // no bloquea bins; solo info del header
      console.warn(getErrorMessage(error));
    }
  }

  async function refreshBins() {
    if (!warehouseId) return;
    setLoading(true);
    try {
      const data = await listWarehouseBins(warehouseId, {
        limit: 1000,
        is_active: showInactive ? undefined : true,
        orderBy: 'code',
        ascending: true,
      });
      setRows(data);
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
  }, [warehouseId, showInactive]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.code.toLowerCase().includes(q) ||
        (r.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  function openCreate() {
    setEditing(null);
    setForm(toFormDefaults());
    setIsModalOpen(true);
  }

  function openEdit(b: WarehouseBinRow) {
    setEditing(b);
    setForm(toFormDefaults(b));
    setIsModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setIsModalOpen(false);
  }

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

  async function onDelete(id: UUID) {
    if (!canWrite) return;
    const ok = await showConfirmAlert({
      title: 'Eliminar ubicación',
      text: 'Se eliminará esta ubicación. La acción puede fallar si existe inventario asociado.',
      confirmButtonText: 'Sí, eliminar',
    });
    if (!ok) return;

    try {
      await deleteWarehouseBin(id);
      showToastSuccess('Ubicación eliminada');
      await refreshBins();
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    }
  }

  if (!canRead) {
    return (
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex-1 h-[100dvh] overflow-hidden">
          <div className="p-6">
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
              No tienes permisos para acceder a ubicaciones.
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!warehouseId) {
    return (
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex-1 h-[100dvh] overflow-hidden">
          <div className="p-6">
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
              Falta el ID de almacén en la ruta.
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
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl md:text-3xl font-bold truncate">
                  Ubicaciones {warehouse ? `— ${warehouse.code}` : ''}
                </h2>
                <p className="text-sm text-gray-600">
                  {warehouse ? warehouse.name : 'Ubicaciones por almacén'}
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  to="/inventory/warehouses"
                  className="rounded-xl border px-4 py-2 text-sm bg-white hover:shadow-sm"
                >
                  ← Almacenes
                </Link>
                {canWrite && (
                  <button
                    onClick={openCreate}
                    className="rounded-xl border px-4 py-2 text-sm bg-white hover:shadow-sm"
                  >
                    + Nuevo
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar ubicación por código o nombre..."
                className="w-full sm:max-w-md rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              />
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Mostrar inactivos
              </label>
              <button
                onClick={() => void refreshBins()}
                className="rounded-xl px-4 py-2 text-sm border bg-white hover:shadow-sm"
              >
                Refrescar
              </button>
            </div>
          </div>
        </header>

        <section className="px-4 md:px-6 lg:px-8 py-6 overflow-auto">
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 border-b bg-gray-50 text-xs font-semibold text-gray-600">
              <div className="col-span-4 px-4 py-3">Código</div>
              <div className="col-span-6 px-4 py-3">Nombre</div>
              <div className="col-span-2 px-4 py-3 text-right">Acciones</div>
            </div>

            {loading ? (
              <div className="p-4 text-sm text-gray-600">Cargando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">Sin resultados.</div>
            ) : (
              filtered.map((b) => (
                <div
                  key={b.id}
                  className={cx(
                    'grid grid-cols-12 border-b last:border-b-0 text-sm',
                    !b.is_active && 'bg-gray-50'
                  )}
                >
                  <div className="col-span-4 px-4 py-3 font-medium">
                    {b.code}
                  </div>
                  <div className="col-span-6 px-4 py-3 text-gray-700">
                    {b.name ?? <span className="text-gray-400">—</span>}
                  </div>
                  <div className="col-span-2 px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canWrite && (
                        <>
                          <button
                            onClick={() => openEdit(b)}
                            className="rounded-lg border px-3 py-1.5 text-xs bg-white hover:shadow-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => void onDelete(b.id)}
                            className="rounded-lg border px-3 py-1.5 text-xs bg-white hover:shadow-sm text-red-600 border-red-200"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-lg rounded-2xl border bg-white shadow-xl">
              <div className="p-5 border-b">
                <h3 className="text-lg font-semibold">
                  {editing ? 'Editar ubicación' : 'Nueva ubicación'}
                </h3>
                <p className="text-sm text-gray-600">
                  El código debe ser único por almacén.
                </p>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="text-gray-700">Código</span>
                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, code: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                  />
                </label>

                <label className="text-sm">
                  <span className="text-gray-700">Nombre (opcional)</span>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, name: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, is_active: e.target.checked }))
                    }
                  />
                  Activo
                </label>
              </div>

              <div className="p-5 border-t flex justify-end gap-2">
                <button
                  onClick={closeModal}
                  className="rounded-xl border px-4 py-2 text-sm bg-white hover:shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  disabled={!canWrite || saving}
                  onClick={() => void onSave()}
                  className={cx(
                    'rounded-xl px-4 py-2 text-sm font-medium border shadow-sm',
                    'bg-gray-900 text-white border-gray-900 hover:opacity-95',
                    (!canWrite || saving) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
