// components/dashboard/technicians/AssigneesTable.tsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Assignee, AssigneeSection } from '../../../types/Assignee';
import {
  getAssigneesPaginated,
  createAssignee,
  updateAssignee,
  deleteAssignee,
  setAssigneeActive,
  bulkSetAssigneeActive,
  formatAssigneeFullName,
} from '../../../services/assigneeService';
import { useCan } from '../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../notifications';

interface Props {
  searchTerm: string;
  // `selectedLocation` no aplica para assignees; se ignora
  selectedLocation?: string;
}

const PAGE_SIZE = 8;
const SECTIONS: (AssigneeSection | 'TODOS')[] = [
  'TODOS',
  'SIN ASIGNAR',
  'Internos',
  'TERCEROS',
  'OTROS',
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function SectionChip({ value }: { value: AssigneeSection }) {
  const map: Record<AssigneeSection, string> = {
    'SIN ASIGNAR': 'bg-gray-100 text-gray-800',
    Internos: 'bg-indigo-100 text-indigo-800',
    TERCEROS: 'bg-amber-100 text-amber-800',
    OTROS: 'bg-slate-100 text-slate-700',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        map[value]
      )}
    >
      {value}
    </span>
  );
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
  last_name: string;
  section: AssigneeSection;
  email: string;
  phone: string;
  user_id: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  last_name: '',
  section: 'SIN ASIGNAR',
  email: '',
  phone: '',
  user_id: '',
  is_active: true,
};

export default function AssigneesTable({ searchTerm }: Props) {
  const checkbox = useRef<HTMLInputElement>(null);

  const [section, setSection] = useState<AssigneeSection | 'TODOS'>('TODOS');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [selectedRows, setSelectedRows] = useState<Assignee[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [detail, setDetail] = useState<Assignee | null>(null);

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = useMemo(() => typeof form.id === 'number', [form.id]);

  const isSearching = searchTerm.trim().length >= 2;

  const canFull = useCan('assignees:full_access');
  const canCancel = useCan('assignees:cancel');
  const canDelete = useCan('assignees:delete');

  useLayoutEffect(() => {
    const isIndeterminate =
      selectedRows.length > 0 && selectedRows.length < assignees.length;
    setChecked(
      selectedRows.length === assignees.length && assignees.length > 0
    );
    setIndeterminate(isIndeterminate);
    if (checkbox.current) checkbox.current.indeterminate = isIndeterminate;
  }, [selectedRows, assignees.length]);

  function toggleAll() {
    setSelectedRows(checked || indeterminate ? [] : assignees);
    setChecked(!checked && !indeterminate);
    setIndeterminate(false);
  }

  async function reload(resetPage?: boolean) {
    setIsLoading(true);
    try {
      const p = resetPage ? 0 : page;
      const { data, count } = await getAssigneesPaginated({
        page: p,
        pageSize: PAGE_SIZE,
        search: isSearching ? searchTerm : undefined,
        section,
        includeInactive,
      });
      setAssignees(data);
      setCount(count);
      if (resetPage) setPage(0);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando responsables'
      );
    } finally {
      setIsLoading(false);
    }
  }

  // efectos: filtros, búsqueda y paginación
  useEffect(() => {
    void reload(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, includeInactive, isSearching, searchTerm]);

  useEffect(() => {
    if (isSearching) return; // cuando hay búsqueda, reset de página ya se hace en el efecto anterior
    void reload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // --- acciones fila ---
  async function handleToggleActive(a: Assignee) {
    if (!canFull) {
      showToastError('No tienes permiso para activar/desactivar técnicos.');
      return;
    }
    setIsLoading(true);
    try {
      await setAssigneeActive(a.id, !a.is_active);
      showToastSuccess(
        !a.is_active ? 'Responsable activado.' : 'Responsable desactivado.'
      );
      await reload();
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error cambiando estado');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(a: Assignee) {
    if (!canDelete) {
      showToastError('No tienes permiso para eliminar técnicos.');
      return;
    }
    const ok = confirm(
      `¿Eliminar al responsable "${formatAssigneeFullName(
        a
      )}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setIsLoading(true);
    try {
      await deleteAssignee(a.id);
      showToastSuccess('Responsable eliminado.');
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error eliminando responsable'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBulkDeactivate() {
    if (!canFull) {
      showToastError('No tienes permiso para activar/desactivar técnicos.');
      return;
    }
    if (selectedRows.length === 0) return;
    const ids = selectedRows.map((r) => r.id);
    setIsLoading(true);
    try {
      await bulkSetAssigneeActive(ids, false);
      showToastSuccess(`Se desactivaron ${ids.length} responsables.`);
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
      showToastError('No tienes permiso para crear/editar técnicos.');
      return;
    }
    setForm(EMPTY_FORM);
    setOpenForm(true);
  }

  function openEdit(a: Assignee) {
    if (!canFull) {
      showToastError('No tienes permiso para crear/editar técnicos.');
      return;
    }
    setForm({
      id: a.id,
      name: a.name,
      last_name: a.last_name,
      section: a.section,
      email: a.email ?? '',
      phone: a.phone ?? '',
      user_id: a.user_id ?? '',
      is_active: a.is_active,
    });
    setOpenForm(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!canFull) {
      showToastError('No tienes permiso para crear/editar técnicos.');
      return;
    }
    if (!form.name.trim() || !form.last_name.trim()) {
      showToastError('Nombre y Apellido son obligatorios.');
      return;
    }
    if (!form.section) {
      showToastError('Selecciona una sección.');
      return;
    }
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateAssignee(form.id!, {
          name: form.name,
          last_name: form.last_name,
          section: form.section,
          email: form.email || null,
          phone: form.phone || null,
          user_id: form.user_id || null,
          is_active: form.is_active,
        });
        showToastSuccess('Responsable actualizado.');
      } else {
        await createAssignee({
          name: form.name,
          last_name: form.last_name,
          section: form.section,
          email: form.email || null,
          phone: form.phone || null,
          user_id: form.user_id || null,
          is_active: form.is_active,
        });
        showToastSuccess('Responsable creado.');
      }
      setOpenForm(false);
      await reload(true);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error guardando responsable'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar superior */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Tabs por sección */}
        <div className="flex flex-wrap items-center gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={cx(
                'px-3 py-1.5 rounded-full text-sm border cursor-pointer',
                section === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
            >
              {s}
            </button>
          ))}
        </div>

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
                ? 'No tienes permiso para crear/editar técnicos'
                : undefined
            }
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Nuevo responsable
          </button>

          <button
            type="button"
            onClick={handleBulkDeactivate}
            disabled={selectedRows.length === 0 || isLoading || !canCancel}
            title={
              !canCancel
                ? 'No tienes permiso para activar/desactivar técnicos'
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
          ) : assignees.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              Sin responsables.
            </div>
          ) : (
            assignees.map((a) => {
              const selected = selectedRows.includes(a);
              return (
                <div
                  key={a.id}
                  className={cx(
                    'rounded-xl border bg-white p-4 shadow-sm',
                    selected && 'ring-1 ring-indigo-300'
                  )}
                  onClick={() => setDetail(a)}
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
                          setSelectedRows((prev) => [...prev, a]);
                        else
                          setSelectedRows((prev) =>
                            prev.filter((x) => x !== a)
                          );
                      }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500">#{a.id}</div>
                      <div className="mt-0.5 text-base font-semibold text-gray-900 line-clamp-1">
                        {formatAssigneeFullName(a)}
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <SectionChip value={a.section} />
                        <ActiveChip active={a.is_active} />
                      </div>

                      {(a.email || a.phone) && (
                        <div className="mt-3 text-sm text-gray-600">
                          {a.email && <span className="mr-2">{a.email}</span>}
                          {a.phone && <span className="mr-2">• {a.phone}</span>}
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
                        setDetail(a);
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
                        openEdit(a);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="text-gray-700 hover:text-gray-900 text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!canCancel}
                      title={
                        !canCancel
                          ? 'No tienes permiso para activar/desactivar'
                          : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(a);
                      }}
                    >
                      {a.is_active ? 'Desactivar' : 'Activar'}
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
                        handleDelete(a);
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
                        disabled={!canFull}
                        title={
                          !canFull
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
                      Sección
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Teléfono
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
                        colSpan={8}
                        className="py-8 text-center text-gray-400"
                      >
                        Cargando…
                      </td>
                    </tr>
                  ) : assignees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-gray-400"
                      >
                        Sin responsables.
                      </td>
                    </tr>
                  ) : (
                    assignees.map((a) => {
                      const selected = selectedRows.includes(a);
                      return (
                        <tr
                          key={a.id}
                          className={cx(
                            'hover:bg-gray-50 transition cursor-pointer',
                            selected && 'bg-indigo-50'
                          )}
                          onClick={() => setDetail(a)}
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
                                  setSelectedRows((prev) => [...prev, a]);
                                else
                                  setSelectedRows((prev) =>
                                    prev.filter((x) => x !== a)
                                  );
                              }}
                            />
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                            #{a.id}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm font-medium text-gray-900 line-clamp-1">
                              {formatAssigneeFullName(a)}
                            </div>
                            <div className="text-sm text-gray-500 line-clamp-1">
                              {a.user_id
                                ? `Usuario vinculado: ${a.user_id}`
                                : '—'}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <SectionChip value={a.section} />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <ActiveChip active={a.is_active} />
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {a.email ?? '—'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {a.phone ?? '—'}
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
                                  openEdit(a);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                className="text-gray-700 hover:text-gray-900 text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!canCancel}
                                title={
                                  !canCancel
                                    ? 'No tienes permiso para activar/desactivar'
                                    : undefined
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleActive(a);
                                }}
                              >
                                {a.is_active ? 'Desactivar' : 'Activar'}
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
                                  handleDelete(a);
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

      {/* Modal Detalle simple */}
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
                  Detalle del responsable
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
                  <div className="text-gray-900 font-medium">
                    {formatAssigneeFullName(detail)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Sección</div>
                  <div className="text-gray-900">
                    <SectionChip value={detail.section} />
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Email</div>
                  <div className="text-gray-900">{detail.email || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Teléfono</div>
                  <div className="text-gray-900">{detail.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Estado</div>
                  <div className="text-gray-900">
                    <ActiveChip active={detail.is_active} />
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">User ID vinculado</div>
                  <div className="text-gray-900">{detail.user_id || '—'}</div>
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
                  {isEditing ? 'Editar responsable' : 'Nuevo responsable'}
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

                {/* Apellido */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Apellido
                  </label>
                  <input
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.last_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, last_name: e.target.value }))
                    }
                    required
                  />
                </div>

                {/* Sección */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Sección
                  </label>
                  <select
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.section}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        section: e.target.value as AssigneeSection,
                      }))
                    }
                    required
                  >
                    {(
                      [
                        'SIN ASIGNAR',
                        'Internos',
                        'TERCEROS',
                        'OTROS',
                      ] as AssigneeSection[]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email (opcional)
                  </label>
                  <input
                    type="email"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Teléfono (opcional)
                  </label>
                  <input
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>

                {/* User ID vinculado */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    User ID vinculado (opcional)
                  </label>
                  <input
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.user_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, user_id: e.target.value }))
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
                        ? 'No tienes permiso para crear/editar técnicos'
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
