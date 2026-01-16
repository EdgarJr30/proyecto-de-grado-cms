import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SpecialIncident } from '../../../types/SpecialIncident';
import {
  getSpecialIncidentsPaginated,
  createSpecialIncident,
  updateSpecialIncident,
  deleteSpecialIncident,
  setSpecialIncidentActive,
  bulkSetSpecialIncidentActive,
} from '../../../services/specialIncidentsService';
import { useCan } from '../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../notifications';

interface Props {
  searchTerm: string;
  // se mantiene por compatibilidad con Navbar
  selectedLocation?: string;
}

const PAGE_SIZE = 8;

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function ActiveChip({ active }: { active: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      )}
    >
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

type FormState = {
  id?: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  code: '',
  description: '',
  is_active: true,
};

export default function SpecialIncidentsTable({ searchTerm }: Props) {
  const checkbox = useRef<HTMLInputElement>(null);

  const [includeInactive, setIncludeInactive] = useState(false);

  const [rows, setRows] = useState<SpecialIncident[]>([]);
  const [selectedRows, setSelectedRows] = useState<SpecialIncident[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [detail, setDetail] = useState<SpecialIncident | null>(null);

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = useMemo(() => typeof form.id === 'number', [form.id]);

  const isSearching = searchTerm.trim().length >= 2;

  // Permisos (alineado a tus RLS/policies dadas)
  const canFull = useCan('special_incidents:full_access');
  const canDisable = useCan('special_incidents:disable');
  const canDelete = useCan('special_incidents:delete');

  useLayoutEffect(() => {
    const isInd = selectedRows.length > 0 && selectedRows.length < rows.length;
    setChecked(selectedRows.length === rows.length && rows.length > 0);
    setIndeterminate(isInd);
    if (checkbox.current) checkbox.current.indeterminate = isInd;
  }, [selectedRows, rows.length]);

  function toggleAll() {
    setSelectedRows(checked || indeterminate ? [] : rows);
    setChecked(!checked && !indeterminate);
    setIndeterminate(false);
  }

  async function reload(resetPage?: boolean) {
    setIsLoading(true);
    try {
      const p = resetPage ? 0 : page;
      const { data, count } = await getSpecialIncidentsPaginated({
        page: p,
        pageSize: PAGE_SIZE,
        search: isSearching ? searchTerm : undefined,
        includeInactive,
      });
      setRows(data);
      setCount(count);
      if (resetPage) setPage(0);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando incidencias especiales'
      );
    } finally {
      setIsLoading(false);
    }
  }

  // efectos: filtros, búsqueda y paginación
  useEffect(() => {
    void reload(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive, isSearching, searchTerm]);

  useEffect(() => {
    if (isSearching) return;
    void reload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // --- acciones fila ---
  async function handleToggleActive(row: SpecialIncident) {
    if (!canFull && !canDisable) {
      showToastError('No tienes permiso para activar/desactivar incidencias.');
      return;
    }
    setIsLoading(true);
    try {
      await setSpecialIncidentActive(row.id, !row.is_active);
      showToastSuccess(
        !row.is_active ? 'Incidencia activada.' : 'Incidencia desactivada.'
      );
      await reload();
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error cambiando estado');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(row: SpecialIncident) {
    if (!canDelete) {
      showToastError('No tienes permiso para eliminar incidencias.');
      return;
    }
    const ok = confirm(
      `¿Eliminar el tipo de incidencia "${row.name}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setIsLoading(true);
    try {
      await deleteSpecialIncident(row.id);
      showToastSuccess('Incidencia eliminada.');
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error eliminando incidencia'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBulkDeactivate() {
    if (!canFull && !canDisable) {
      showToastError('No tienes permiso para activar/desactivar incidencias.');
      return;
    }
    if (selectedRows.length === 0) return;
    const ids = selectedRows.map((r) => r.id);
    setIsLoading(true);
    try {
      await bulkSetSpecialIncidentActive(ids, false);
      showToastSuccess(`Se desactivaron ${ids.length} incidencias.`);
      setSelectedRows([]);
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error en desactivación masiva'
      );
    } finally {
      setIsLoading(false);
    }
  }

  function openCreate() {
    if (!canFull) {
      showToastError('No tienes permiso para crear/editar incidencias.');
      return;
    }
    setForm(EMPTY_FORM);
    setOpenForm(true);
  }

  function openEdit(row: SpecialIncident) {
    if (!canFull) {
      showToastError('No tienes permiso para crear/editar incidencias.');
      return;
    }
    setForm({
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description ?? '',
      is_active: row.is_active,
    });
    setOpenForm(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!canFull) {
      showToastError('No tienes permiso para crear/editar incidencias.');
      return;
    }
    if (!form.name.trim()) {
      showToastError('El nombre es obligatorio.');
      return;
    }
    if (!form.code.trim()) {
      showToastError('El código es obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateSpecialIncident(form.id!, {
          name: form.name,
          code: form.code,
          description: form.description || null,
          is_active: form.is_active,
        });
        showToastSuccess('Incidencia actualizada.');
      } else {
        await createSpecialIncident({
          name: form.name,
          code: form.code,
          description: form.description || null,
          is_active: form.is_active,
        });
        showToastSuccess('Incidencia creada.');
      }
      setOpenForm(false);
      await reload(true);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error guardando incidencia'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar superior */}
      <div className="flex flex-wrap items-center gap-2">
        {/* (No hay tabs por secciones; este recurso no las necesita) */}
        <div className="ml-auto flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-600 cursor-pointer"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Mostrar inactivos
          </label>

          <button
            type="button"
            onClick={openCreate}
            disabled={!canFull}
            title={
              !canFull
                ? 'No tienes permiso para crear/editar incidencias'
                : undefined
            }
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Nueva incidencia
          </button>

          <button
            type="button"
            onClick={handleBulkDeactivate}
            disabled={
              selectedRows.length === 0 ||
              isLoading ||
              (!canFull && !canDisable)
            }
            title={
              !canFull && !canDisable
                ? 'No tienes permiso para activar/desactivar'
                : undefined
            }
            className="inline-flex items-center rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Desactivar selección
          </button>
        </div>
      </div>

      {/* Meta de paginación */}
      <div className="mt-2 text-sm text-gray-700">
        {isSearching ? (
          <span>
            Resultados filtrados por “{searchTerm}” — {count} encontrado(s)
          </span>
        ) : (
          <span>
            Página {page + 1} de {Math.max(1, Math.ceil(count / PAGE_SIZE))} —{' '}
            {count} total
          </span>
        )}
      </div>

      {/* CONTENEDOR SCROLLABLE */}
      <div className="mt-3 flex-1 min-h-0">
        {/* ===== Vista Móvil: tarjetas ===== */}
        <div className="md:hidden space-y-3 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-gray-400">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              Sin incidencias.
            </div>
          ) : (
            rows.map((r) => {
              const selected = selectedRows.includes(r);
              return (
                <div
                  key={r.id}
                  className={cx(
                    'rounded-xl border bg-white p-4 shadow-sm',
                    selected && 'ring-1 ring-indigo-300'
                  )}
                  onClick={() => setDetail(r)}
                >
                  <div className="flex items-start gap-3">
                    {/* checkbox */}
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      checked={selected}
                      onClick={(e) => e.stopPropagation()}
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
                      <div className="text-xs text-gray-500">#{r.id}</div>
                      <div className="mt-0.5 text-base font-semibold text-gray-900 line-clamp-1">
                        {r.name}
                      </div>
                      <div className="mt-1 text-sm font-mono text-gray-600">
                        {r.code}
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <ActiveChip active={r.is_active} />
                      </div>

                      {r.description && (
                        <div className="mt-3 text-sm text-gray-600 line-clamp-2">
                          {r.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="mt-3 flex items-center justify-end gap-4">
                    <button
                      className="text-indigo-600 hover:text-indigo-500 text-sm cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetail(r);
                      }}
                    >
                      Ver
                    </button>
                    <button
                      className="text-emerald-600 hover:text-emerald-500 text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!canFull}
                      title={
                        !canFull ? 'No tienes permiso para editar' : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(r);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="text-gray-700 hover:text-gray-900 text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!canFull && !canDisable}
                      title={
                        !canFull && !canDisable
                          ? 'No tienes permiso para activar/desactivar'
                          : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(r);
                      }}
                    >
                      {r.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      className="text-rose-600 hover:text-rose-500 text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!canDelete}
                      title={
                        !canDelete
                          ? 'No tienes permiso para eliminar'
                          : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(r);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ===== Vista md+: tabla sticky ===== */}
        <div className="hidden md:block h-full min-h-0 overflow-auto">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-auto rounded-lg ring-1 ring-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 w-12">
                      <input
                        ref={checkbox}
                        type="checkbox"
                        disabled={!canFull && !canDisable}
                        title={
                          !canFull && !canDisable
                            ? 'No tienes permiso para seleccionar para desactivar'
                            : undefined
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        checked={checked}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleAll();
                        }}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Código
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-gray-400"
                      >
                        Cargando…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-gray-400"
                      >
                        Sin incidencias.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const selected = selectedRows.includes(r);
                      return (
                        <tr
                          key={r.id}
                          className={cx(
                            'hover:bg-gray-50 transition cursor-pointer',
                            selected && 'bg-indigo-50'
                          )}
                          onClick={() => setDetail(r)}
                        >
                          <td
                            className="relative px-6 w-12"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {selected && (
                              <div className="absolute inset-y-0 left-0 w-0.5 bg-indigo-600" />
                            )}
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
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
                          <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                            #{r.id}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm font-medium text-gray-900 line-clamp-1">
                              {r.name}
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-sm text-gray-800 whitespace-nowrap">
                            {r.code}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <ActiveChip active={r.is_active} />
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            <div className="line-clamp-1">
                              {r.description ?? '—'}
                            </div>
                          </td>
                          <td
                            className="px-4 py-4 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                className="text-emerald-600 hover:text-emerald-500 text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!canFull}
                                title={
                                  !canFull
                                    ? 'No tienes permiso para editar'
                                    : undefined
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(r);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                className="text-gray-700 hover:text-gray-900 text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!canFull && !canDisable}
                                title={
                                  !canFull && !canDisable
                                    ? 'No tienes permiso para activar/desactivar'
                                    : undefined
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleActive(r);
                                }}
                              >
                                {r.is_active ? 'Desactivar' : 'Activar'}
                              </button>
                              <button
                                className="text-rose-600 hover:text-rose-500 text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!canDelete}
                                title={
                                  !canDelete
                                    ? 'No tienes permiso para eliminar'
                                    : undefined
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(r);
                                }}
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
      </div>

      {/* Paginación (solo cuando NO hay búsqueda) */}
      {!isSearching && (
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium disabled:opacity-40 cursor-pointer hover:bg-gray-300 disabled:hover:bg-gray-200"
          >
            Anterior
          </button>
          <button
            onClick={() =>
              setPage((p) => (p + 1 < Math.ceil(count / PAGE_SIZE) ? p + 1 : p))
            }
            disabled={page + 1 >= Math.ceil(count / PAGE_SIZE)}
            className="px-4 py-2 rounded bg-indigo-600 text-white font-medium disabled:opacity-40 cursor-pointer hover:bg-indigo-500 disabled:hover:bg-indigo-600"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal Detalle */}
      {detail && (
        <div className="fixed inset-0 z-50" onClick={() => setDetail(null)}>
          <div className="fixed inset-0 bg-black/30" />
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Detalle de la incidencia
                </h2>
                <button
                  onClick={() => setDetail(null)}
                  className="text-gray-500"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Nombre</div>
                  <div className="text-gray-900 font-medium">{detail.name}</div>
                </div>
                <div>
                  <div className="text-gray-500">Código</div>
                  <div className="text-gray-900 font-mono">{detail.code}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500">Descripción</div>
                  <div className="text-gray-900">
                    {detail.description || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Estado</div>
                  <div className="text-gray-900">
                    <ActiveChip active={detail.is_active} />
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Actualizado</div>
                  <div className="text-gray-900">
                    {new Date(detail.updated_at).toLocaleString('es-DO')}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={() => setDetail(null)}
                >
                  Cerrar
                </button>
                <button
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!canFull}
                  title={!canFull ? 'No tienes permiso para editar' : undefined}
                  onClick={() => {
                    if (!canFull) return;
                    openEdit(detail);
                    setDetail(null);
                  }}
                >
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar */}
      {openForm && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-black/30"
            onClick={() => setOpenForm(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {isEditing ? 'Editar incidencia' : 'Nueva incidencia'}
                </h2>
                <button
                  onClick={() => setOpenForm(false)}
                  className="text-gray-500"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={submitForm} className="mt-4 space-y-4">
                {/* Nombre */}
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
                    required
                  />
                </div>

                {/* Código */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Código
                  </label>
                  <input
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                    placeholder="huracan, tormenta_electrica"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        code: e.target.value.toLowerCase().trim(),
                      }))
                    }
                    required
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Descripción (opcional)
                  </label>
                  <textarea
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </div>

                {/* Activo */}
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_active: e.target.checked }))
                    }
                  />
                  Activo
                </label>

                {/* Botones */}
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
                    disabled={submitting || !canFull}
                    title={
                      !canFull
                        ? 'No tienes permiso para crear/editar'
                        : undefined
                    }
                  >
                    {submitting
                      ? isEditing
                        ? 'Guardando…'
                        : 'Creando…'
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
    </div>
  );
}
