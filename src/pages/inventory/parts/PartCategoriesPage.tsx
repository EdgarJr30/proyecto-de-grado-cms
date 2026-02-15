import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../../../components/layout/Sidebar';
import { usePermissions } from '../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../notifications';
import type {
  PartCategoryInsert,
  PartCategoryRow,
  PartCategoryUpdate,
} from '../../../types/inventory';
import {
  listPartCategories,
  createPartCategory,
  updatePartCategory,
  deletePartCategory,
} from '../../../services/inventory';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type FormState = {
  id?: string;
  name: string;
  parent_id: string | null;
};

const EMPTY_FORM: FormState = { name: '', parent_id: null };

function buildCategoryLabelMap(rows: PartCategoryRow[]) {
  const byId = new Map<string, PartCategoryRow>();
  rows.forEach((r) => byId.set(r.id, r));

  const labelOf = (id: string | null) => {
    if (!id) return null;
    const r = byId.get(id);
    return r ? r.name : null;
  };

  const breadcrumbOf = (id: string) => {
    const seen = new Set<string>();
    const parts: string[] = [];

    let cur = byId.get(id) ?? null;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      parts.unshift(cur.name);
      cur = cur.parent_id ? (byId.get(cur.parent_id) ?? null) : null;
    }

    return parts.join(' / ');
  };

  return { labelOf, breadcrumbOf };
}

export default function PartCategoriesPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canManage = has('inventory:full_access');

  const checkbox = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<PartCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedRows, setSelectedRows] = useState<PartCategoryRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = typeof form.id === 'string';

  const helpers = useMemo(() => buildCategoryLabelMap(rows), [rows]);

  const parentOptions = useMemo(() => {
    // Orden por nombre
    const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    // cuando editas, no permitimos asignarse a sí mismo como parent
    return isEditing ? sorted.filter((r) => r.id !== form.id) : sorted;
  }, [rows, isEditing, form.id]);

  function toggleAll() {
    setSelectedRows(checked || indeterminate ? [] : rows);
    setChecked(!checked && !indeterminate);
    setIndeterminate(false);
  }

  async function reload() {
    if (!canRead) return;
    setIsLoading(true);
    try {
      const data = await listPartCategories({
        limit: 1000,
        offset: 0,
        orderBy: 'name',
        ascending: true,
      });
      setRows(data);
      setSelectedRows([]);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando categorías'
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  function openCreate() {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    setForm(EMPTY_FORM);
    setOpenForm(true);
  }

  function openEdit(row: PartCategoryRow) {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    setForm({ id: row.id, name: row.name, parent_id: row.parent_id });
    setOpenForm(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    if (!form.name.trim()) return showToastError('El nombre es obligatorio.');

    setSubmitting(true);
    try {
      const payload: PartCategoryInsert = {
        name: form.name.trim(),
        parent_id: form.parent_id ?? null,
      };

      if (isEditing) {
        const patch: PartCategoryUpdate = {
          name: payload.name,
          parent_id: payload.parent_id ?? null,
        };
        await updatePartCategory(form.id!, patch);
        showToastSuccess('Categoría actualizada.');
      } else {
        await createPartCategory(payload);
        showToastSuccess('Categoría creada.');
      }

      setOpenForm(false);
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error guardando categoría'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(row: PartCategoryRow) {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    const ok = confirm(`¿Eliminar la categoría "${row.name}"?`);
    if (!ok) return;

    setIsLoading(true);
    try {
      await deletePartCategory(row.id);
      showToastSuccess('Categoría eliminada.');
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error eliminando categoría'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    if (selectedRows.length === 0) return;

    const ok = confirm(`¿Eliminar ${selectedRows.length} categoría(s)?`);
    if (!ok) return;

    setIsLoading(true);
    try {
      for (const r of selectedRows) await deletePartCategory(r.id);
      showToastSuccess(`Se eliminaron ${selectedRows.length} categoría(s).`);
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
              Categorías de repuestos
            </h2>
            <p className="text-sm text-gray-600">
              Árbol de categorías (padre/hijo) para clasificar repuestos.
            </p>
          </div>
        </header>

        <div className="px-4 md:px-6 lg:px-8 mt-4 flex flex-wrap items-center gap-2">
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
              Nueva categoría
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
                const parent = helpers.labelOf(r.parent_id) ?? '—';
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
                        <div className="text-sm font-semibold text-gray-900">
                          {r.name}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          Padre: <span className="font-medium">{parent}</span>
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
                        Nombre
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Padre
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Ruta
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
                          colSpan={5}
                          className="py-10 text-center text-gray-400"
                        >
                          Cargando…
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-10 text-center text-gray-400"
                        >
                          Sin resultados.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => {
                        const selected = selectedRows.includes(r);
                        const parent = helpers.labelOf(r.parent_id) ?? '—';
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
                            <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                              {r.name}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">
                              {parent}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-500">
                              {helpers.breadcrumbOf(r.id)}
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

        {/* Modal */}
        {openForm && (
          <div className="fixed inset-0 z-50">
            <div
              className="fixed inset-0 bg-black/30"
              onClick={() => setOpenForm(false)}
            />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {isEditing ? 'Editar categoría' : 'Nueva categoría'}
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
                      Nombre
                    </label>
                    <input
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Ej: Eléctrico, Hidráulico…"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Tip: usa nombres cortos y consistentes.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Categoría padre
                    </label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={form.parent_id ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          parent_id: e.target.value ? e.target.value : null,
                        }))
                      }
                    >
                      <option value="">— Sin padre —</option>
                      {parentOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
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
