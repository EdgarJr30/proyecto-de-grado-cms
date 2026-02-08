import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { usePermissions } from '../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../notifications';

import type {
  PartCriticality,
  PartInsert,
  PartRow,
  PartUpdate,
  UomRow,
  PartCategoryRow,
} from '../../types/inventory';
import {
  listParts,
  createPart,
  updatePart,
  deletePart,
  listPartCategories,
  listUoms,
} from '../../services/inventory';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type FormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  uom_id: string;
  category_id: string | null;
  criticality: PartCriticality;
  is_active: boolean;
  is_stocked: boolean;
};

const DEFAULT_CRIT: PartCriticality = 'MEDIUM';

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  description: '',
  uom_id: '',
  category_id: null,
  criticality: DEFAULT_CRIT,
  is_active: true,
  is_stocked: true,
};

function CriticalityBadge({ value }: { value: PartCriticality }) {
  const cls =
    value === 'LOW'
      ? 'bg-gray-50 text-gray-700 border-gray-200'
      : value === 'MEDIUM'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : value === 'HIGH'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-rose-50 text-rose-700 border-rose-200';

  const label =
    value === 'LOW'
      ? 'Low'
      : value === 'MEDIUM'
        ? 'Medium'
        : value === 'HIGH'
          ? 'High'
          : 'Critical';

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        cls
      )}
    >
      {label}
    </span>
  );
}

function Chip({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'danger' | 'muted';
}) {
  const cls =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'danger'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : tone === 'muted'
          ? 'bg-gray-50 text-gray-600 border-gray-200'
          : 'bg-indigo-50 text-indigo-700 border-indigo-200';

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        cls
      )}
    >
      {children}
    </span>
  );
}

export default function PartsPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canManage = has('inventory:full_access');

  const checkbox = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [parts, setParts] = useState<PartRow[]>([]);
  const [uoms, setUoms] = useState<UomRow[]>([]);
  const [categories, setCategories] = useState<PartCategoryRow[]>([]);

  const [selectedRows, setSelectedRows] = useState<PartRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = typeof form.id === 'string';

  const uomById = useMemo(() => new Map(uoms.map((u) => [u.id, u])), [uoms]);
  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  function toggleAll() {
    setSelectedRows(checked || indeterminate ? [] : parts);
    setChecked(!checked && !indeterminate);
    setIndeterminate(false);
  }

  async function reload() {
    if (!canRead) return;
    setIsLoading(true);
    try {
      const [u, c, p] = await Promise.all([
        listUoms({ limit: 1000, offset: 0, orderBy: 'code', ascending: true }),
        listPartCategories({
          limit: 2000,
          offset: 0,
          orderBy: 'name',
          ascending: true,
        }),
        listParts({ limit: 1000, offset: 0, orderBy: 'code', ascending: true }),
      ]);
      setUoms(u);
      setCategories(c);
      setParts(p);
      setSelectedRows([]);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando repuestos'
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

  function openEdit(row: PartRow) {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    setForm({
      id: row.id,
      code: row.code ?? '',
      name: row.name ?? '',
      description: row.description ?? '',
      uom_id: row.uom_id,
      category_id: row.category_id ?? null,
      criticality: row.criticality,
      is_active: row.is_active,
      is_stocked: row.is_stocked,
    });
    setOpenForm(true);
  }

  function normalizeCode(raw: string) {
    // Convención: Parts code en uppercase tipo BRG-001
    return raw.trim().toUpperCase();
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');

    const code = normalizeCode(form.code);
    const name = form.name.trim();
    const description = form.description.trim();

    if (!code) return showToastError('El código es obligatorio.');
    if (!name) return showToastError('El nombre es obligatorio.');
    if (!form.uom_id) return showToastError('Debes seleccionar una UoM.');

    setSubmitting(true);
    try {
      const payload: PartInsert = {
        code,
        name,
        description: description ? description : null,
        uom_id: form.uom_id,
        category_id: form.category_id ?? null,
        criticality: form.criticality,
        is_active: form.is_active,
        is_stocked: form.is_stocked,
      };

      if (isEditing) {
        const patch: PartUpdate = payload;
        await updatePart(form.id!, patch);
        showToastSuccess('Repuesto actualizado.');
      } else {
        await createPart(payload);
        showToastSuccess('Repuesto creado.');
      }

      setOpenForm(false);
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error guardando repuesto'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(row: PartRow) {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    const ok = confirm(`¿Eliminar el repuesto "${row.code}"?`);
    if (!ok) return;

    setIsLoading(true);
    try {
      await deletePart(row.id);
      showToastSuccess('Repuesto eliminado.');
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error eliminando repuesto'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    if (selectedRows.length === 0) return;

    const ok = confirm(`¿Eliminar ${selectedRows.length} repuesto(s)?`);
    if (!ok) return;

    setIsLoading(true);
    try {
      for (const r of selectedRows) await deletePart(r.id);
      showToastSuccess(`Se eliminaron ${selectedRows.length} repuesto(s).`);
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
              Repuestos (Parts)
            </h2>
            <p className="text-sm text-gray-600">
              Catálogo de repuestos con UoM, categoría, criticidad y banderas
              operativas.
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
              Nuevo repuesto
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
            ) : parts.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                Sin resultados.
              </div>
            ) : (
              parts.map((p) => {
                const selected = selectedRows.includes(p);
                const u = uomById.get(p.uom_id)?.code ?? '—';
                const c = p.category_id
                  ? (catById.get(p.category_id)?.name ?? '—')
                  : '—';

                return (
                  <div
                    key={p.id}
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
                            setSelectedRows((prev) => [...prev, p]);
                          else
                            setSelectedRows((prev) =>
                              prev.filter((x) => x !== p)
                            );
                        }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-mono text-gray-900">
                            {p.code}
                          </div>
                          <CriticalityBadge value={p.criticality} />
                        </div>

                        <div className="mt-1 text-sm font-semibold text-gray-900">
                          {p.name}
                        </div>

                        {p.description ? (
                          <div className="mt-1 text-xs text-gray-600 line-clamp-2">
                            {p.description}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Chip tone={p.is_active ? 'success' : 'danger'}>
                            {p.is_active ? 'Activo' : 'Inactivo'}
                          </Chip>
                          <Chip tone={p.is_stocked ? 'default' : 'muted'}>
                            {p.is_stocked ? 'Stocked' : 'No stocked'}
                          </Chip>
                          <Chip tone="muted">UoM: {u}</Chip>
                          <Chip tone="muted">Cat: {c}</Chip>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end gap-4">
                      <button
                        className="text-indigo-600 hover:text-indigo-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={!canManage}
                        onClick={() => openEdit(p)}
                      >
                        Editar
                      </button>
                      <button
                        className="text-rose-600 hover:text-rose-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={!canManage}
                        onClick={() => handleDelete(p)}
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
                        UoM
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Categoría
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Stock
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Criticidad
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
                          colSpan={9}
                          className="py-10 text-center text-gray-400"
                        >
                          Cargando…
                        </td>
                      </tr>
                    ) : parts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-10 text-center text-gray-400"
                        >
                          Sin resultados.
                        </td>
                      </tr>
                    ) : (
                      parts.map((p) => {
                        const selected = selectedRows.includes(p);
                        const u = uomById.get(p.uom_id)?.code ?? '—';
                        const c = p.category_id
                          ? (catById.get(p.category_id)?.name ?? '—')
                          : '—';

                        return (
                          <tr
                            key={p.id}
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
                                    setSelectedRows((prev) => [...prev, p]);
                                  else
                                    setSelectedRows((prev) =>
                                      prev.filter((x) => x !== p)
                                    );
                                }}
                              />
                            </td>

                            <td className="px-4 py-4 text-sm font-mono text-gray-900 whitespace-nowrap">
                              {p.code}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900 font-semibold">
                              {p.name}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">
                              {u}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">
                              {c}
                            </td>

                            <td className="px-4 py-4">
                              <Chip tone={p.is_active ? 'success' : 'danger'}>
                                {p.is_active ? 'Activo' : 'Inactivo'}
                              </Chip>
                            </td>

                            <td className="px-4 py-4">
                              <Chip tone={p.is_stocked ? 'default' : 'muted'}>
                                {p.is_stocked ? 'Stocked' : 'No stocked'}
                              </Chip>
                            </td>

                            <td className="px-4 py-4">
                              <CriticalityBadge value={p.criticality} />
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <button
                                  className="text-indigo-600 hover:text-indigo-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                  disabled={!canManage}
                                  onClick={() => openEdit(p)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="text-rose-600 hover:text-rose-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                  disabled={!canManage}
                                  onClick={() => handleDelete(p)}
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
              <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {isEditing ? 'Editar repuesto' : 'Nuevo repuesto'}
                  </h2>
                  <button
                    onClick={() => setOpenForm(false)}
                    className="text-gray-500"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={submitForm} className="mt-4 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        onBlur={() =>
                          setForm((f) => ({
                            ...f,
                            code: normalizeCode(f.code),
                          }))
                        }
                        placeholder="BRG-001"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Se normaliza a{' '}
                        <span className="font-mono">UPPERCASE</span>.
                      </p>
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
                        placeholder="Bearing 6203…"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Descripción
                      </label>
                      <textarea
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        rows={3}
                        value={form.description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Notas, especificaciones, equivalencias…"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        UoM
                      </label>
                      <select
                        className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={form.uom_id}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, uom_id: e.target.value }))
                        }
                        required
                      >
                        <option value="">Selecciona…</option>
                        {uoms.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.code} — {u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Categoría
                      </label>
                      <select
                        className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={form.category_id ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            category_id: e.target.value ? e.target.value : null,
                          }))
                        }
                      >
                        <option value="">— Sin categoría —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Criticidad
                      </label>
                      <select
                        className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={form.criticality}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            criticality: e.target.value as PartCriticality,
                          }))
                        }
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="CRITICAL">CRITICAL</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        id="is_active"
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        checked={form.is_active}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            is_active: e.target.checked,
                          }))
                        }
                      />
                      <label
                        htmlFor="is_active"
                        className="text-sm font-medium text-gray-700"
                      >
                        Activo
                      </label>

                      <span className="ml-auto">
                        <Chip tone={form.is_active ? 'success' : 'danger'}>
                          {form.is_active ? 'Activo' : 'Inactivo'}
                        </Chip>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        id="is_stocked"
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        checked={form.is_stocked}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            is_stocked: e.target.checked,
                          }))
                        }
                      />
                      <label
                        htmlFor="is_stocked"
                        className="text-sm font-medium text-gray-700"
                      >
                        Stocked
                      </label>

                      <span className="ml-auto">
                        <Chip tone={form.is_stocked ? 'default' : 'muted'}>
                          {form.is_stocked ? 'Stocked' : 'No stocked'}
                        </Chip>
                      </span>
                    </div>
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

                  <div className="border-t pt-4">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Chip tone={form.is_active ? 'success' : 'danger'}>
                        {form.is_active ? 'Activo' : 'Inactivo'}
                      </Chip>
                      <Chip tone={form.is_stocked ? 'default' : 'muted'}>
                        {form.is_stocked ? 'Stocked' : 'No stocked'}
                      </Chip>
                      <CriticalityBadge value={form.criticality} />
                      <Chip tone="muted">
                        Code:{' '}
                        <span className="font-mono ml-1">
                          {normalizeCode(form.code || '—')}
                        </span>
                      </Chip>
                    </div>
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
