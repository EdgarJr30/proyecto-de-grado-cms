import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { useCan } from '../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../notifications';
import type { UUID, VendorInsert, VendorRow } from '../../types/inventory';
import {
  createVendor,
  deleteVendor,
  listVendors,
  updateVendor,
} from '../../services/inventory/vendorsService';
import PartVendorsPage from './PartVendorsPage';
import { useLocation, useNavigate } from 'react-router-dom';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type VendorsTab = 'vendors' | 'part-vendors';

const emptyVendor: VendorInsert = {
  name: '',
  email: null,
  phone: null,
  is_active: true,
};

function useQueryTab(): VendorsTab {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const t = params.get('tab');
  return t === 'part-vendors' ? 'part-vendors' : 'vendors';
}

export default function VendorsPage() {
  const canRead = useCan('inventory:read');
  const canFull = useCan('inventory:full_access');
  const isReadOnly = !canFull;

  const navigate = useNavigate();
  const location = useLocation();

  const tab = useQueryTab();

  const setTab = (next: VendorsTab) => {
    const params = new URLSearchParams(location.search);
    params.set('tab', next);
    navigate(
      { pathname: location.pathname, search: params.toString() },
      { replace: true }
    );
  };

  const canSee = canRead || canFull;

  // ----------------------------
  // Tab 1 state: Vendors CRUD
  // ----------------------------
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);

  const [editingId, setEditingId] = useState<UUID | null>(null);
  const [form, setForm] = useState<VendorInsert>(emptyVendor);

  const addDisabledCls = (base = '') =>
    base + (isReadOnly ? ' opacity-50 cursor-not-allowed bg-gray-100' : '');

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((v) => v.name.toLowerCase().includes(s));
  }, [rows, search]);

  const refresh = async () => {
    if (!canSee) return;

    setLoading(true);
    try {
      const data = await listVendors({
        limit: 500,
        offset: 0,
        orderBy: 'name',
        ascending: true,
        is_active: onlyActive ? true : undefined,
      });
      setRows(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToastError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // solo refresca vendors si estamos viendo el tab de vendors
    if (tab !== 'vendors') return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyActive, canRead, canFull, tab]);

  const startEdit = (v: VendorRow) => {
    setEditingId(v.id);
    setForm({
      name: v.name,
      email: v.email,
      phone: v.phone,
      is_active: v.is_active,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyVendor);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    const name = form.name.trim();
    if (!name) {
      showToastError('Nombre es requerido.');
      return;
    }

    try {
      if (editingId) {
        await updateVendor(editingId, {
          name,
          email: form.email?.trim() ? form.email.trim() : null,
          phone: form.phone?.trim() ? form.phone.trim() : null,
          is_active: !!form.is_active,
        });
        showToastSuccess('Proveedor actualizado.');
      } else {
        await createVendor({
          name,
          email: form.email?.trim() ? form.email.trim() : null,
          phone: form.phone?.trim() ? form.phone.trim() : null,
          is_active: form.is_active ?? true,
        });
        showToastSuccess('Proveedor creado.');
      }

      resetForm();
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToastError(`No se pudo guardar: ${msg}`);
    }
  };

  const onDelete = async (id: UUID) => {
    if (isReadOnly) return;
    try {
      await deleteVendor(id);
      showToastSuccess('Proveedor eliminado.');
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToastError(`No se pudo eliminar: ${msg}`);
    }
  };

  // ✅ MISMO patrón que UomsPage para “sin permisos”
  if (!canSee) {
    return (
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
              No tienes permisos para acceder al módulo de proveedores.
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
        {/* Header */}
        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl md:text-3xl font-bold">Proveedores</h2>
            <p className="text-sm text-gray-600">
              Administra proveedores y la relación repuesto–proveedor.
            </p>
          </div>
        </header>

        {/* Toolbar: Tabs + acciones según tab */}
        <div className="px-4 md:px-6 lg:px-8 mt-4 flex flex-wrap items-center gap-2">
          {/* Tabs */}
          <div className="inline-flex rounded-lg border bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setTab('vendors')}
              className={cx(
                'px-4 py-2 text-sm',
                tab === 'vendors'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-700'
              )}
            >
              Proveedores
            </button>
            <button
              type="button"
              onClick={() => setTab('part-vendors')}
              className={cx(
                'px-4 py-2 text-sm border-l',
                tab === 'part-vendors'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-700'
              )}
            >
              Repuesto–Proveedor
            </button>
          </div>

          {/* Toolbar contextual */}
          {tab === 'vendors' ? (
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre…"
                className="px-3 py-2 border rounded w-64 bg-white"
              />

              <label className="text-sm flex items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                />
                Solo activos
              </label>
            </div>
          ) : (
            <div className="ml-auto text-sm text-gray-600">
              Selecciona un repuesto para ver/editar sus proveedores.
            </div>
          )}
        </div>

        {/* Contenedor scrollable */}
        <section className="px-4 md:px-6 lg:px-8 py-6 overflow-auto flex-1 min-h-0">
          {tab === 'vendors' ? (
            <div className="space-y-4">
              {/* Form */}
              <form
                onSubmit={onSubmit}
                className={cx(
                  'rounded-2xl border bg-white p-4 shadow-sm space-y-3',
                  isReadOnly && 'opacity-60'
                )}
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Nombre</label>
                    <input
                      value={form.name}
                      disabled={isReadOnly}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                      className={addDisabledCls(
                        'mt-1 w-full px-3 py-2 border rounded-md'
                      )}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <input
                      value={form.email ?? ''}
                      disabled={isReadOnly}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, email: e.target.value }))
                      }
                      className={addDisabledCls(
                        'mt-1 w-full px-3 py-2 border rounded-md'
                      )}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Teléfono</label>
                    <input
                      value={form.phone ?? ''}
                      disabled={isReadOnly}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, phone: e.target.value }))
                      }
                      className={addDisabledCls(
                        'mt-1 w-full px-3 py-2 border rounded-md'
                      )}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.is_active ?? true}
                      disabled={isReadOnly}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, is_active: e.target.checked }))
                      }
                    />
                    Activo
                  </label>

                  <div className="flex gap-2">
                    {editingId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isReadOnly}
                      className={cx(
                        'rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500',
                        isReadOnly && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {editingId ? 'Guardar' : 'Crear'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Table */}
              <div className="overflow-auto rounded-xl ring-1 ring-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Nombre
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Teléfono
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 w-44">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-10 text-center text-gray-400"
                        >
                          Cargando…
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-10 text-center text-gray-400"
                        >
                          Sin proveedores.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((v) => (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 font-medium text-gray-900">
                            {v.name}
                          </td>
                          <td className="px-4 py-4 text-gray-700">
                            {v.email ?? '—'}
                          </td>
                          <td className="px-4 py-4 text-gray-700">
                            {v.phone ?? '—'}
                          </td>
                          <td className="px-4 py-4">
                            {v.is_active ? (
                              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                                Activo
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => startEdit(v)}
                                disabled={isReadOnly}
                                className={cx(
                                  'text-indigo-600 hover:text-indigo-500 text-sm',
                                  isReadOnly && 'opacity-40 cursor-not-allowed'
                                )}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void onDelete(v.id)}
                                disabled={isReadOnly}
                                className={cx(
                                  'text-rose-600 hover:text-rose-500 text-sm',
                                  isReadOnly && 'opacity-40 cursor-not-allowed'
                                )}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // TAB 2: PartVendors embebido (sin sidebar, ya lo trae esta página)
            <PartVendorsPage embedded />
          )}
        </section>
      </main>
    </div>
  );
}
