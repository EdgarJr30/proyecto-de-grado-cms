import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useCan } from '../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../notifications';

interface Props {
  searchTerm: string;
  // compat con Navbar (si no se usa para sociedad, lo ignoramos)
  selectedLocation?: string;
}

const PAGE_SIZE = 10;

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/**
 * AJUSTA ESTO A TU ESQUEMA REAL:
 * - Tabla sugerida: public.societies
 * - Campos: id, name, logo_url, is_active, updated_at
 */
export type Society = {
  id: number;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  updated_at: string;
};

type FormState = {
  id?: number;
  name: string;
  logo_url: string | null; // placeholder para después (solo lectura/preview por ahora)
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  logo_url: null,
  is_active: true,
};

export default function SocietySettingsTable({ searchTerm }: Props) {
  const checkbox = useRef<HTMLInputElement>(null);

  // permisos (alineado a tu RBAC)
  const canSocietyRead = useCan('society:read');
  const canSocietyFull = useCan('society:full_access');

  const canRead = canSocietyRead || canSocietyFull;
  const canFull = canSocietyFull;

  const isSearching = searchTerm.trim().length >= 2;

  // data/paginación
  const [rows, setRows] = useState<Society[]>([]);
  const [selectedRows, setSelectedRows] = useState<Society[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);
  const [page, setPage] = useState(0);
  const [, setCount] = useState(0); // aproximado
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<Society | null>(null);

  // modal form
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = useMemo(() => typeof form.id === 'number', [form.id]);

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
    if (!canRead) {
      setRows([]);
      setCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const p = resetPage ? 0 : page;

      // 👇 AJUSTA: tabla/columnas
      let query = supabase
        .from('societies')
        .select('id,name,logo_url,is_active,updated_at')
        .order('updated_at', { ascending: false })
        .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);

      if (isSearching) {
        const term = searchTerm.trim();
        // simple search: name ilike %term%
        query = query.ilike('name', `%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const list = (data ?? []) as Society[];
      setRows(list);

      // count aproximado para UX
      setCount((prev) =>
        p === 0 ? (list.length < PAGE_SIZE ? list.length : PAGE_SIZE * 3) : prev
      );

      if (resetPage) setPage(0);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando sociedades'
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearching, searchTerm, canRead]);

  useEffect(() => {
    if (isSearching) return;
    void reload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function openCreate() {
    if (!canFull) {
      showToastError('No tienes permiso para crear/editar sociedades.');
      return;
    }
    setForm(EMPTY_FORM);
    setOpenForm(true);
  }

  function openEdit(row: Society) {
    if (!canFull) {
      showToastError('No tienes permiso para editar sociedades.');
      return;
    }
    setForm({
      id: row.id,
      name: row.name,
      logo_url: row.logo_url,
      is_active: row.is_active,
    });
    setOpenForm(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();

    if (!canFull) {
      showToastError('No tienes permiso para crear/editar sociedades.');
      return;
    }

    const name = form.name.trim();
    if (!name) {
      showToastError('El nombre de la sociedad es obligatorio.');
      return;
    }

    setSubmitting(true);
    try {
      // ✅ por ahora: solo name (y mantenemos logo_url y is_active como mapeo base)
      const payload = {
        id: form.id,
        name,
        // mapeo para después
        logo_url: form.logo_url,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('societies')
        .upsert(payload, { onConflict: 'id' })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      showToastSuccess(
        isEditing ? 'Sociedad actualizada.' : 'Sociedad creada.'
      );
      setOpenForm(false);
      setSelectedRows([]);
      setDetail(null);

      // recargar desde primera página para ver reflejado
      await reload(true);

      // si quieres usar data.id luego:
      void data?.id;
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error guardando sociedad'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar superior */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={openCreate}
            disabled={!canFull}
            title={
              !canFull
                ? 'No tienes permiso para crear/editar sociedades'
                : undefined
            }
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Nueva sociedad
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-2 text-sm text-gray-700">
        {isSearching ? (
          <span>Resultados filtrados por “{searchTerm}”</span>
        ) : (
          <span>
            Página {page + 1} — {rows.length} elementos (página)
          </span>
        )}
      </div>

      {/* Contenedor scroll */}
      <div className="mt-3 flex-1 min-h-0">
        {/* Vista móvil */}
        <div className="md:hidden space-y-3 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-gray-400">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              Sin sociedades.
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

                      <div className="mt-0.5 text-base font-semibold text-gray-900 line-clamp-2">
                        {r.name}
                      </div>

                      {/* Logo (mapeo/preview) */}
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="font-medium">Logo:</span>{' '}
                        {r.logo_url ? (
                          <a
                            href={r.logo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 hover:underline break-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.logo_url}
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>

                      <div className="mt-2 text-xs text-gray-600">
                        <span className="font-medium">Actualizado:</span>{' '}
                        {new Date(r.updated_at).toLocaleString('es-DO')}
                      </div>
                    </div>
                  </div>

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
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Vista md+: tabla */}
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
                            ? 'No tienes permiso para seleccionar'
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
                      Logo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Actualizado
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
                        colSpan={6}
                        className="py-8 text-center text-gray-400"
                      >
                        Cargando…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-gray-400"
                      >
                        Sin sociedades.
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
                            <div className="text-sm font-medium text-gray-900">
                              {r.name}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-xs max-w-[320px] truncate">
                            {r.logo_url ? (
                              <a
                                href={r.logo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {r.logo_url}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="px-4 py-4 text-xs text-gray-700 whitespace-nowrap">
                            {new Date(r.updated_at).toLocaleString('es-DO')}
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
                                onClick={() => openEdit(r)}
                              >
                                Editar
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

      {/* Paginación simple (si no hay búsqueda) */}
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
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 rounded bg-indigo-600 text-white font-medium disabled:opacity-40 cursor-pointer hover:bg-indigo-500"
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
                  Detalle de la sociedad
                </h2>
                <button
                  onClick={() => setDetail(null)}
                  className="text-gray-500"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2">
                  <div className="text-gray-500">Nombre</div>
                  <div className="text-gray-900 font-medium">{detail.name}</div>
                </div>

                <div className="col-span-2">
                  <div className="text-gray-500">Logo (placeholder)</div>
                  <div className="text-gray-900 break-all">
                    {detail.logo_url ? (
                      <a
                        href={detail.logo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        {detail.logo_url}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>

                <div className="col-span-2">
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
            <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {isEditing ? 'Editar sociedad' : 'Nueva sociedad'}
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
                    Nombre de la sociedad
                  </label>
                  <input
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    required
                    maxLength={120}
                    placeholder="Ej: CILM / FINCO / etc."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    (Por ahora solo estamos guardando el nombre. Logo y colores
                    vienen después.)
                  </p>
                </div>

                {/* Logo (solo mapeo/placeholder) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Logo (placeholder)
                  </label>
                  <input
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.logo_url ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        logo_url: e.target.value.trim() || null,
                      }))
                    }
                    placeholder="https://... (por ahora opcional)"
                    disabled
                    title="Luego lo habilitamos con upload a storage"
                  />
                </div>

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
