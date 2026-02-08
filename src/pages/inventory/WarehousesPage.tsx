import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { usePermissions } from '../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../notifications';
import type {
  WarehouseInsert,
  WarehouseRow,
  WarehouseUpdate,
  UUID,
} from '../../types/inventory';
import {
  createWarehouse,
  deleteWarehouse,
  listWarehouses,
  updateWarehouse,
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
  location_label: string;
  is_active: boolean;
};

function toFormDefaults(w?: WarehouseRow): FormState {
  return {
    code: w?.code ?? '',
    name: w?.name ?? '',
    location_label: w?.location_label ?? '',
    is_active: w?.is_active ?? true,
  };
}

export default function WarehousesPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canWrite = has('inventory:full_access'); // o inventory:write si lo tienes

  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [form, setForm] = useState<FormState>(() => toFormDefaults());
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listWarehouses({
        limit: 500,
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
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.location_label ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  function openCreate() {
    setEditing(null);
    setForm(toFormDefaults());
    setIsModalOpen(true);
  }

  function openEdit(w: WarehouseRow) {
    setEditing(w);
    setForm(toFormDefaults(w));
    setIsModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setIsModalOpen(false);
  }

  async function onSave() {
    if (!canWrite) return;

    const code = form.code.trim();
    const name = form.name.trim();

    if (!code || !name) {
      showToastError('Code y Name son requeridos.');
      return;
    }

    setSaving(true);
    try {
      if (!editing) {
        const payload: WarehouseInsert = {
          code,
          name,
          location_label: form.location_label.trim() || null,
          is_active: form.is_active,
        };
        await createWarehouse(payload);
        showToastSuccess('Warehouse creado');
      } else {
        const patch: WarehouseUpdate = {
          code,
          name,
          location_label: form.location_label.trim() || null,
          is_active: form.is_active,
        };
        await updateWarehouse(editing.id, patch);
        showToastSuccess('Warehouse actualizado');
      }

      setIsModalOpen(false);
      await refresh();
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: UUID) {
    if (!canWrite) return;
    const ok = window.confirm(
      '¿Eliminar este warehouse? (Esto puede fallar si tiene bins/stock)'
    );
    if (!ok) return;

    try {
      await deleteWarehouse(id);
      showToastSuccess('Warehouse eliminado');
      await refresh();
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
              No tienes permisos para acceder a Warehouses.
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
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Warehouses</h2>
              <p className="text-sm text-gray-600">
                Configura almacenes base para manejar stock.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Mostrar inactivos
              </label>

              {canWrite && (
                <button
                  onClick={openCreate}
                  className={cx(
                    'rounded-xl px-4 py-2 text-sm font-medium border bg-white shadow-sm',
                    'hover:shadow transition'
                  )}
                >
                  + Nuevo
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por code, name o location..."
              className="w-full sm:max-w-md rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
            <button
              onClick={() => void refresh()}
              className="rounded-xl px-4 py-2 text-sm border bg-white hover:shadow-sm"
            >
              Refrescar
            </button>
          </div>
        </header>

        <section className="px-4 md:px-6 lg:px-8 py-6 overflow-auto">
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-0 border-b bg-gray-50 text-xs font-semibold text-gray-600">
              <div className="col-span-3 px-4 py-3">Code</div>
              <div className="col-span-4 px-4 py-3">Name</div>
              <div className="col-span-3 px-4 py-3">Location</div>
              <div className="col-span-2 px-4 py-3 text-right">Acciones</div>
            </div>

            {loading ? (
              <div className="p-4 text-sm text-gray-600">Cargando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">Sin resultados.</div>
            ) : (
              filtered.map((w) => (
                <div
                  key={w.id}
                  className={cx(
                    'grid grid-cols-12 gap-0 border-b last:border-b-0 text-sm',
                    !w.is_active && 'bg-gray-50'
                  )}
                >
                  <div className="col-span-3 px-4 py-3 font-medium text-gray-900">
                    {w.code}
                  </div>
                  <div className="col-span-4 px-4 py-3 text-gray-800">
                    {w.name}
                  </div>
                  <div className="col-span-3 px-4 py-3 text-gray-700">
                    {w.location_label ?? (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                  <div className="col-span-2 px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/inventory/warehouses/${w.id}/bins`}
                        className="rounded-lg border px-3 py-1.5 text-xs bg-white hover:shadow-sm"
                      >
                        Bins
                      </Link>

                      {canWrite && (
                        <>
                          <button
                            onClick={() => openEdit(w)}
                            className="rounded-lg border px-3 py-1.5 text-xs bg-white hover:shadow-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => void onDelete(w.id)}
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
                  {editing ? 'Editar Warehouse' : 'Nuevo Warehouse'}
                </h3>
                <p className="text-sm text-gray-600">Code debe ser único.</p>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="text-gray-700">Code</span>
                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, code: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                  />
                </label>

                <label className="text-sm">
                  <span className="text-gray-700">Name</span>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, name: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                  />
                </label>

                <label className="text-sm md:col-span-2">
                  <span className="text-gray-700">
                    Location label (opcional)
                  </span>
                  <input
                    value={form.location_label}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, location_label: e.target.value }))
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
