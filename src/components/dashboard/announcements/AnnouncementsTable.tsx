import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useCan } from '../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../notifications';

import type { Announcement } from '../../../types/Announcements';
import type { AdminListParams } from '../../../services/announcementService'; // ajusta si tu archivo tiene otro nombre
import {
  getAllAnnouncementsForAdmin,
  upsertAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementActive,
  getAnnouncementAudienceRoles,
  setAnnouncementAudienceRoles,
  clearAnnouncementAudienceRoles,
} from '../../../services/announcementService';

interface Props {
  searchTerm: string;
  // compat con Navbar (si no se usa para anuncios, lo ignoramos)
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

function DismissibleChip({ value }: { value: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        value ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-700'
      )}
    >
      {value ? 'Descartable' : 'Fijo'}
    </span>
  );
}

function LevelBadge({ level }: { level: Announcement['level'] }) {
  const map: Record<string, string> = {
    info: 'bg-indigo-100 text-indigo-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-800',
    success: 'bg-emerald-100 text-emerald-800',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        map[level] ?? map.info
      )}
    >
      {level}
    </span>
  );
}

function AudienceBadge({ all }: { all: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        all
          ? 'bg-purple-100 text-purple-800'
          : 'bg-fuchsia-100 text-fuchsia-800'
      )}
    >
      {all ? 'Todos los roles' : 'Roles específicos'}
    </span>
  );
}

type FormState = {
  id?: number;
  message: string;
  level: Announcement['level'];
  url: string;
  is_active: boolean;
  dismissible: boolean;
  starts_at: string | null; // ISO (o null)
  ends_at: string | null; // ISO (o null)
  audience_all: boolean;
  audience_roles: number[]; // solo si audience_all = false
};

const EMPTY_FORM: FormState = {
  message: '',
  level: 'info',
  url: '',
  is_active: true,
  dismissible: true,
  starts_at: null,
  ends_at: null,
  audience_all: true,
  audience_roles: [],
};

type RoleLite = { id: number; name: string | null };

export default function AnnouncementsTable({ searchTerm }: Props) {
  const checkbox = useRef<HTMLInputElement>(null);

  // filtros/controles
  const [onlyActive, setOnlyActive] = useState(false);
  const [includeFuture, setIncludeFuture] = useState(true);
  const [includeExpired, setIncludeExpired] = useState(true);

  // data/paginación
  const [rows, setRows] = useState<Announcement[]>([]);
  const [selectedRows, setSelectedRows] = useState<Announcement[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);
  const [page, setPage] = useState(0);
  const [, setCount] = useState(0); // aproximado: range no devuelve count, puedes ajustar con un RPC si necesitas exactitud
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<Announcement | null>(null);

  // modal form
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = useMemo(() => typeof form.id === 'number', [form.id]);

  // soporte roles para audiencia
  const [roles, setRoles] = useState<RoleLite[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // permisos (alineado a tu RBAC)
  const canRead =
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useCan('announcements:read') || useCan('announcements:full_access');
  const canFull = useCan('announcements:full_access');
  const canDisable = useCan('announcements:disable') || canFull;
  const canDelete = useCan('announcements:delete') || canFull;

  const isSearching = searchTerm.trim().length >= 2;

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

  async function loadRolesIfNeeded() {
    if (roles.length > 0 || loadingRoles) return;
    try {
      setLoadingRoles(true);
      const { data, error } = await supabase
        .from('roles')
        .select('id,name')
        .order('id', { ascending: true });
      if (error) throw new Error(error.message);
      setRoles((data ?? []) as RoleLite[]);
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error cargando roles');
    } finally {
      setLoadingRoles(false);
    }
  }

  async function reload(resetPage?: boolean) {
    if (!canRead) {
      setRows([]);
      setCount(0);
      return;
    }
    setIsLoading(true);
    try {
      const p = resetPage ? 0 : page;
      const params: AdminListParams = {
        search: isSearching ? searchTerm : undefined,
        onlyActive: onlyActive || undefined,
        includeFuture,
        includeExpired,
        from: p * PAGE_SIZE,
        limit: PAGE_SIZE,
        orderBy: 'updated_at',
        ascending: false,
      };
      const { data, error } = await getAllAnnouncementsForAdmin(params);
      if (error) throw error;
      const list = data ?? [];
      setRows(list);
      // Nota: sin count desde range; aproximación para UX (si page > 0 y list < PAGE_SIZE, es la última)
      setCount((prev) =>
        p === 0 ? (list.length < PAGE_SIZE ? list.length : PAGE_SIZE * 3) : prev
      ); // si necesitas exacto, crea un RPC count()
      if (resetPage) setPage(0);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando anuncios'
      );
    } finally {
      setIsLoading(false);
    }
  }

  // efectos: filtros, búsqueda y paginación
  useEffect(() => {
    void reload(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyActive, includeFuture, includeExpired, isSearching, searchTerm]);

  useEffect(() => {
    if (isSearching) return;
    void reload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // --- acciones fila ---
  async function handleToggleActive(row: Announcement) {
    if (!canDisable) {
      showToastError('No tienes permiso para activar/desactivar anuncios.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await toggleAnnouncementActive(row.id, !row.is_active);
      if (res.error) throw res.error;
      showToastSuccess(
        !row.is_active ? 'Anuncio activado.' : 'Anuncio desactivado.'
      );
      await reload();
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error cambiando estado');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(row: Announcement) {
    if (!canDelete) {
      showToastError('No tienes permiso para eliminar anuncios.');
      return;
    }
    const ok = confirm(
      `¿Eliminar el anuncio "${row.message.substring(
        0,
        80
      )}..."? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setIsLoading(true);
    try {
      const res = await deleteAnnouncement(row.id);
      if (res.error) throw res.error;
      showToastSuccess('Anuncio eliminado.');
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error eliminando anuncio'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBulkDeactivate() {
    if (!canDisable) {
      showToastError('No tienes permiso para activar/desactivar anuncios.');
      return;
    }
    if (selectedRows.length === 0) return;
    setIsLoading(true);
    try {
      for (const r of selectedRows) {
        if (r.is_active) {
          const res = await toggleAnnouncementActive(r.id, false);
          if (res.error) throw res.error;
        }
      }
      showToastSuccess(
        `Se desactivaron ${
          selectedRows.filter((r) => r.is_active).length
        } anuncios.`
      );
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
      showToastError('No tienes permiso para crear/editar anuncios.');
      return;
    }
    setForm(EMPTY_FORM);
    setOpenForm(true);
    void loadRolesIfNeeded();
  }

  async function openEdit(row: Announcement) {
    if (!canFull) {
      showToastError('No tienes permiso para crear/editar anuncios.');
      return;
    }
    // cargar roles y roles asignados
    await loadRolesIfNeeded();
    let roleIds: number[] = [];
    try {
      const { data, error } = await getAnnouncementAudienceRoles(row.id);
      if (error) throw error;
      roleIds = data ?? [];
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando audiencia de roles'
      );
    }
    setForm({
      id: row.id,
      message: row.message,
      level: row.level,
      url: row.url ?? '',
      is_active: row.is_active,
      dismissible: row.dismissible,
      starts_at: row.starts_at ? new Date(row.starts_at).toISOString() : null,
      ends_at: row.ends_at ? new Date(row.ends_at).toISOString() : null,
      audience_all: row.audience_all,
      audience_roles: roleIds,
    });
    setOpenForm(true);
  }

  // helpers de fecha para <input type="datetime-local">
  function isoToLocalValue(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    // YYYY-MM-DDTHH:MM (sin segundos)
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function localValueToIso(v: string): string | null {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
    // Si prefieres zona 'America/Santo_Domingo' exacta, ajusta aquí con luxon/dayjs-tz
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!canFull) {
      showToastError('No tienes permiso para crear/editar anuncios.');
      return;
    }
    if (!form.message.trim()) {
      showToastError('El mensaje es obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        id: form.id,
        message: form.message,
        level: form.level,
        url: form.url || null,
        is_active: form.is_active,
        dismissible: form.dismissible,
        starts_at: form.starts_at
          ? new Date(form.starts_at).toISOString()
          : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        audience_all: form.audience_all,
        audience_roles: form.audience_all ? [] : form.audience_roles,
      };

      const { data, error } = await upsertAnnouncement(payload);
      if (error) throw error;

      // como seguridad adicional, si audience_all cambió a true, limpiamos roles
      if (payload.audience_all === true && data) {
        const cleared = await clearAnnouncementAudienceRoles(data.id);
        if (cleared.error) throw cleared.error;
      } else if (data && payload.audience_all === false) {
        const res = await setAnnouncementAudienceRoles(
          data.id,
          payload.audience_roles ?? []
        );
        if (res.error) throw res.error;
      }

      showToastSuccess(isEditing ? 'Anuncio actualizado.' : 'Anuncio creado.');
      setOpenForm(false);
      await reload(true);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error guardando anuncio'
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
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-600 cursor-pointer"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            Solo activos
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-600 cursor-pointer"
              checked={includeFuture}
              onChange={(e) => setIncludeFuture(e.target.checked)}
            />
            Incluir futuros
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-600 cursor-pointer"
              checked={includeExpired}
              onChange={(e) => setIncludeExpired(e.target.checked)}
            />
            Incluir expirados
          </label>

          <button
            type="button"
            onClick={openCreate}
            disabled={!canFull}
            title={
              !canFull
                ? 'No tienes permiso para crear/editar anuncios'
                : undefined
            }
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Nuevo anuncio
          </button>

          <button
            type="button"
            onClick={handleBulkDeactivate}
            disabled={selectedRows.length === 0 || isLoading || !canDisable}
            title={
              !canDisable
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
            <div className="py-8 text-center text-gray-400">Sin anuncios.</div>
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
                        {r.message}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <LevelBadge level={r.level} />
                        <ActiveChip active={r.is_active} />
                        <DismissibleChip value={r.dismissible} />
                        <AudienceBadge all={r.audience_all} />
                      </div>
                      <div className="mt-2 text-xs text-gray-600 space-x-2">
                        {r.starts_at && (
                          <span>
                            Desde:{' '}
                            {new Date(r.starts_at).toLocaleString('es-DO')}
                          </span>
                        )}
                        {r.ends_at && (
                          <span>
                            • Hasta:{' '}
                            {new Date(r.ends_at).toLocaleString('es-DO')}
                          </span>
                        )}
                      </div>
                      {r.url && (
                        <div className="mt-2 text-xs">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 hover:underline"
                          >
                            {r.url}
                          </a>
                        </div>
                      )}
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
                        void openEdit(r);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="text-gray-700 hover:text-gray-900 text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!canDisable}
                      title={
                        !canDisable
                          ? 'No tienes permiso para activar/desactivar'
                          : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleToggleActive(r);
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
                        void handleDelete(r);
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
                        disabled={!canDisable}
                        title={
                          !canDisable
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
                      Mensaje
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Nivel
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Desc.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Audiencia
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Vigencia
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      URL
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
                        colSpan={10}
                        className="py-8 text-center text-gray-400"
                      >
                        Cargando…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="py-8 text-center text-gray-400"
                      >
                        Sin anuncios.
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
                            <div className="text-sm font-medium text-gray-900 line-clamp-2">
                              {r.message}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <LevelBadge level={r.level} />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <ActiveChip active={r.is_active} />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <DismissibleChip value={r.dismissible} />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <AudienceBadge all={r.audience_all} />
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-700 whitespace-nowrap">
                            {r.starts_at
                              ? new Date(r.starts_at).toLocaleString('es-DO')
                              : '—'}
                            {r.ends_at
                              ? ` → ${new Date(r.ends_at).toLocaleString(
                                  'es-DO'
                                )}`
                              : ''}
                          </td>
                          <td className="px-4 py-4 text-xs max-w-[220px] truncate">
                            {r.url ? (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 hover:underline"
                              >
                                {r.url}
                              </a>
                            ) : (
                              '—'
                            )}
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
                                  void openEdit(r);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                className="text-gray-700 hover:text-gray-900 text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!canDisable}
                                title={
                                  !canDisable
                                    ? 'No tienes permiso para activar/desactivar'
                                    : undefined
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleToggleActive(r);
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
                                  void handleDelete(r);
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
                <h2 className="text-lg font-semibold">Detalle del anuncio</h2>
                <button
                  onClick={() => setDetail(null)}
                  className="text-gray-500"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2">
                  <div className="text-gray-500">Mensaje</div>
                  <div className="text-gray-900 font-medium whitespace-pre-wrap">
                    {detail.message}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Nivel</div>
                  <div className="text-gray-900">
                    <LevelBadge level={detail.level} />
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Estado</div>
                  <div className="text-gray-900">
                    <ActiveChip active={detail.is_active} />
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Descartable</div>
                  <div className="text-gray-900">
                    <DismissibleChip value={detail.dismissible} />
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Audiencia</div>
                  <div className="text-gray-900">
                    <AudienceBadge all={detail.audience_all} />
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Desde</div>
                  <div className="text-gray-900">
                    {detail.starts_at
                      ? new Date(detail.starts_at).toLocaleString('es-DO')
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Hasta</div>
                  <div className="text-gray-900">
                    {detail.ends_at
                      ? new Date(detail.ends_at).toLocaleString('es-DO')
                      : '—'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500">URL</div>
                  <div className="text-gray-900 break-all">
                    {detail.url ? (
                      <a
                        href={detail.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        {detail.url}
                      </a>
                    ) : (
                      '—'
                    )}
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
                    void openEdit(detail);
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
                  {isEditing ? 'Editar anuncio' : 'Nuevo anuncio'}
                </h2>
                <button
                  onClick={() => setOpenForm(false)}
                  className="text-gray-500"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={submitForm} className="mt-4 space-y-4">
                {/* Mensaje */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Mensaje
                  </label>
                  <textarea
                    rows={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.message}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, message: e.target.value }))
                    }
                    required
                  />
                </div>

                {/* Nivel y URL */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Nivel
                    </label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={form.level}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          level: e.target.value as Announcement['level'],
                        }))
                      }
                    >
                      <option value="info">info</option>
                      <option value="warning">warning</option>
                      <option value="danger">danger</option>
                      <option value="success">success</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      URL (opcional)
                    </label>
                    <input
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="https://tusitio.com/aviso"
                      value={form.url}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, url: e.target.value.trim() }))
                      }
                    />
                  </div>
                </div>

                {/* Vigencia */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Vigente desde
                    </label>
                    <input
                      type="datetime-local"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={isoToLocalValue(form.starts_at)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          starts_at: localValueToIso(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Vigente hasta
                    </label>
                    <input
                      type="datetime-local"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={isoToLocalValue(form.ends_at)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          ends_at: localValueToIso(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Activo / Descartable */}
                <div className="flex flex-wrap items-center gap-6">
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
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                      checked={form.dismissible}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          dismissible: e.target.checked,
                        }))
                      }
                    />
                    Descartable por el usuario
                  </label>
                </div>

                {/* Audiencia */}
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">Audiencia</div>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                        checked={form.audience_all}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            audience_all: e.target.checked,
                          }))
                        }
                      />
                      Todos los roles
                    </label>
                  </div>

                  {!form.audience_all && (
                    <div className="mt-3">
                      <label className="block text-sm text-gray-700 mb-1">
                        Selecciona roles
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {loadingRoles ? (
                          <div className="text-sm text-gray-500">
                            Cargando roles…
                          </div>
                        ) : roles.length === 0 ? (
                          <div className="text-sm text-gray-500">
                            No hay roles disponibles.
                          </div>
                        ) : (
                          roles.map((r) => {
                            const selected = form.audience_roles.includes(r.id);
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  setForm((f) => ({
                                    ...f,
                                    audience_roles: selected
                                      ? f.audience_roles.filter(
                                          (x) => x !== r.id
                                        )
                                      : [...f.audience_roles, r.id],
                                  }));
                                }}
                                className={cx(
                                  'px-3 py-1 rounded-full text-xs border',
                                  selected
                                    ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                )}
                              >
                                #{r.id} {r.name ?? '(sin nombre)'}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
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
