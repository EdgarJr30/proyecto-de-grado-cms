import { useEffect, useRef, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { usePermissions } from '../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../notifications';
import type { UomInsert, UomRow, UomUpdate } from '../../types/inventory';
import {
  createUom,
  deleteUom,
  listUoms,
  updateUom,
} from '../../services/inventory/uomsService';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type FormState = {
  id?: string;
  code: string;
  name: string;
};

const EMPTY_FORM: FormState = { code: '', name: '' };

export default function UomsPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canManage = has('inventory:full_access');

  const checkbox = useRef<HTMLInputElement>(null);

  const [searchTerm] = useState('');

  const [rows, setRows] = useState<UomRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedRows, setSelectedRows] = useState<UomRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = typeof form.id === 'string';

  function toggleAll() {
    setSelectedRows(checked || indeterminate ? [] : rows);
    setChecked(!checked && !indeterminate);
    setIndeterminate(false);
  }

  async function reload() {
    if (!canRead) return;
    setIsLoading(true);
    try {
      const data = await listUoms({
        limit: 500,
        offset: 0,
        orderBy: 'code',
        ascending: true,
      });
      setRows(data);
      setSelectedRows([]);
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error cargando UoM');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  function openCreate() {
    if (!canManage) {
      showToastError(
        'No tienes permiso para gestionar maestros de inventario.'
      );
      return;
    }
    setForm(EMPTY_FORM);
    setOpenForm(true);
  }

  function openEdit(row: UomRow) {
    if (!canManage) {
      showToastError(
        'No tienes permiso para gestionar maestros de inventario.'
      );
      return;
    }
    setForm({ id: row.id, code: row.code, name: row.name });
    setOpenForm(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) {
      showToastError(
        'No tienes permiso para gestionar maestros de inventario.'
      );
      return;
    }
    if (!form.code.trim()) return showToastError('El código es obligatorio.');
    if (!form.name.trim()) return showToastError('El nombre es obligatorio.');

    setSubmitting(true);
    try {
      const payload: UomInsert = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
      };

      if (isEditing) {
        const patch: UomUpdate = { code: payload.code, name: payload.name };
        await updateUom(form.id!, patch);
        showToastSuccess('UoM actualizada.');
      } else {
        await createUom(payload);
        showToastSuccess('UoM creada.');
      }

      setOpenForm(false);
      await reload();
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error guardando UoM');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(row: UomRow) {
    if (!canManage) {
      showToastError(
        'No tienes permiso para gestionar maestros de inventario.'
      );
      return;
    }
    const ok = confirm(`¿Eliminar la UoM "${row.code}"?`);
    if (!ok) return;

    setIsLoading(true);
    try {
      await deleteUom(row.id);
      showToastSuccess('UoM eliminada.');
      await reload();
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error eliminando UoM');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (!canManage) {
      showToastError(
        'No tienes permiso para gestionar maestros de inventario.'
      );
      return;
    }
    if (selectedRows.length === 0) return;
    const ok = confirm(`¿Eliminar ${selectedRows.length} UoM(s)?`);
    if (!ok) return;

    setIsLoading(true);
    try {
      for (const r of selectedRows) await deleteUom(r.id);
      showToastSuccess(`Se eliminaron ${selectedRows.length} UoM(s).`);
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error en eliminación masiva'
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (!canRead) {
    return (
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
              No tienes permisos para acceder al módulo de inventario.
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
        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl md:text-3xl font-bold">
              Unidades de medida (UoM)
            </h2>
            <p className="text-sm text-gray-600">
              Códigos y nombres usados en consumo e inventario.
            </p>
          </div>
        </header>

        {/* Toolbar */}
        <div className="px-4 md:px-6 lg:px-8 mt-4 flex flex-wrap items-center gap-2">
          <div className="text-sm text-gray-600">
            {searchTerm.trim().length >= 2 ? (
              <span>Filtrado por “{searchTerm}” - resultado(s)</span>
            ) : (
              <span>Total: {rows.length}</span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={openCreate}
              disabled={!canManage}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                !canManage
                  ? 'No tienes permiso para gestionar maestros'
                  : undefined
              }
            >
              Nueva UoM
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={!canManage || isLoading || selectedRows.length === 0}
              className="inline-flex items-center rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Eliminar selección
            </button>
          </div>
        </div>

        {/* Contenedor scrollable */}
        <section className="px-4 md:px-6 lg:px-8 py-6 overflow-auto flex-1 min-h-0">
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className="py-10 text-center text-gray-400">Cargando…</div>
            ) : rows.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                Sin resultados.
              </div>
            ) : (
              rows.map((r) => {
                const selected = selectedRows.includes(r);
                return (
                  <div
                    key={r.id}
                    className={cx(
                      'rounded-2xl border bg-white p-4 shadow-sm',
                      selected && 'ring-1 ring-indigo-300'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        checked={selected}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelectedRows((prev) => [...prev, r]);
                          else
                            setSelectedRows((prev) =>
                              prev.filter((x) => x !== r)
                            );
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono text-gray-900">
                          {r.code}
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          {r.name}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end gap-4">
                      <button
                        className="text-indigo-600 hover:text-indigo-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={!canManage}
                        onClick={() => openEdit(r)}
                      >
                        Editar
                      </button>
                      <button
                        className="text-rose-600 hover:text-rose-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={!canManage}
                        onClick={() => handleDelete(r)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block h-full min-h-0 overflow-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-auto rounded-xl ring-1 ring-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 w-12">
                        <input
                          ref={checkbox}
                          type="checkbox"
                          disabled={!canManage}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                          checked={checked}
                          onChange={toggleAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Código
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Nombre
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-10 text-center text-gray-400"
                        >
                          Cargando…
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-10 text-center text-gray-400"
                        >
                          Sin resultados.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => {
                        const selected = selectedRows.includes(r);
                        return (
                          <tr
                            key={r.id}
                            className={cx(
                              'hover:bg-gray-50',
                              selected && 'bg-indigo-50'
                            )}
                          >
                            <td className="relative px-6 w-12">
                              {selected && (
                                <div className="absolute inset-y-0 left-0 w-0.5 bg-indigo-600" />
                              )}
                              <input
                                type="checkbox"
                                disabled={!canManage}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                checked={selected}
                                onChange={(e) => {
                                  if (e.target.checked)
                                    setSelectedRows((prev) => [...prev, r]);
                                  else
                                    setSelectedRows((prev) =>
                                      prev.filter((x) => x !== r)
                                    );
                                }}
                              />
                            </td>
                            <td className="px-4 py-4 text-sm font-mono text-gray-900 whitespace-nowrap">
                              {r.code}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">
                              {r.name}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <button
                                  className="text-indigo-600 hover:text-indigo-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                  disabled={!canManage}
                                  onClick={() => openEdit(r)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="text-rose-600 hover:text-rose-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                  disabled={!canManage}
                                  onClick={() => handleDelete(r)}
                                >
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
            </div>
          </div>
        </section>

        {/* Modal Create/Edit */}
        {openForm && (
          <div className="fixed inset-0 z-50">
            <div
              className="fixed inset-0 bg-black/30"
              onClick={() => setOpenForm(false)}
            />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {isEditing ? 'Editar UoM' : 'Nueva UoM'}
                  </h2>
                  <button
                    onClick={() => setOpenForm(false)}
                    className="text-gray-500"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={submitForm} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Código
                    </label>
                    <input
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                      value={form.code}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, code: e.target.value }))
                      }
                      placeholder="EA, UND, LB..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Nombre
                    </label>
                    <input
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Unidad, Libra..."
                      required
                    />
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenForm(false)}
                      className="rounded-md border px-3 py-2 text-sm"
                      disabled={submitting}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                      disabled={submitting || !canManage}
                      title={
                        !canManage
                          ? 'No tienes permiso para gestionar maestros'
                          : undefined
                      }
                    >
                      {submitting
                        ? 'Guardando…'
                        : isEditing
                          ? 'Guardar cambios'
                          : 'Crear'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
