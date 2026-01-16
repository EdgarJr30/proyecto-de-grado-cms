import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../../../context/AuthContext';
import { useUser } from '../../../context/UserContext';
import { LOCATIONS } from '../../../constants/locations';
import { useCan } from '../../../rbac/PermissionsContext';
import { supabaseNoPersist } from '../../../lib/supabaseNoPersist';
import {
  getUsersPaginated,
  updateUser,
  setUserActive,
  bulkSetUserActive,
  deleteUser,
  type DbUser,
} from '../../../services/userAdminService';
import { showToastError, showToastSuccess } from '../../../notifications';
import { formatDateInTimezone } from '../../../utils/formatDate';
import { MAX_EMAIL_LENGTH } from '../../../utils/validators';

interface Role {
  id: number;
  name: string;
}

interface Props {
  searchTerm: string;
  selectedLocation: string;
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

// Helper seguro para extraer mensajes de error (evita TS2339)
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const anyErr = err as {
      message?: string;
      error_description?: string;
      error?: string;
      code?: string;
    };
    return (
      anyErr.message ??
      anyErr.error_description ??
      anyErr.error ??
      anyErr.code ??
      'Ocurrió un error'
    );
  }
  return 'Ocurrió un error';
}

type FormState = {
  id?: string;
  name: string;
  last_name: string;
  email: string;
  location: string;
  rol_id: number | '';
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  last_name: '',
  email: '',
  location: '',
  rol_id: '',
  is_active: true,
};

export default function UsersTable({ searchTerm, selectedLocation }: Props) {
  const checkbox = useRef<HTMLInputElement>(null);

  const [includeInactive, setIncludeInactive] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);

  const [rows, setRows] = useState<DbUser[]>([]);
  const [selectedRows, setSelectedRows] = useState<DbUser[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [detail, setDetail] = useState<DbUser | null>(null);

  // Crear usuario (modal)
  const [openCreate, setOpenCreate] = useState(false);
  const [nameC, setNameC] = useState('');
  const [lastNameC, setLastNameC] = useState('');
  const [emailC, setEmailC] = useState('');
  const [locationC, setLocationC] = useState('');
  const [passwordC, setPasswordC] = useState('');
  const [rolIdC, setRolIdC] = useState<number | ''>('');
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [msgCreate, setMsgCreate] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Editar usuario (modal)
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = useMemo(() => typeof form.id === 'string', [form.id]);

  const isSearching = searchTerm.trim().length >= 2;

  const { refresh: refreshAuth } = useAuth();
  const { refresh: refreshUser } = useUser();

  // Permisos
  const canRead = useCan('users:read');
  const canFull = useCan('users:full_access');
  const canCancel = useCan('users:cancel');
  const canDelete = useCan('users:delete');
  const canManageRoles = useCan('rbac:manage_roles');

  const [errors] = useState<Partial<Record<keyof FormState | 'image', string>>>(
    {}
  );

  useLayoutEffect(() => {
    const isIndet =
      selectedRows.length > 0 && selectedRows.length < rows.length;
    setChecked(selectedRows.length === rows.length && rows.length > 0);
    setIndeterminate(isIndet);
    if (checkbox.current) checkbox.current.indeterminate = isIndet;
  }, [selectedRows, rows.length]);

  function toggleAll() {
    setSelectedRows(checked || indeterminate ? [] : rows);
    setChecked(!checked && !indeterminate);
    setIndeterminate(false);
  }

  async function reload(resetPage?: boolean) {
    if (!canRead && !canFull) return;
    setIsLoading(true);
    try {
      const p = resetPage ? 0 : page;
      const { data, count } = await getUsersPaginated({
        page: p,
        pageSize: PAGE_SIZE,
        search: isSearching ? searchTerm : undefined,
        location: selectedLocation,
        includeInactive,
      });
      setRows(data);
      setCount(count);
      if (resetPage) setPage(0);
    } catch (e) {
      showToastError(extractErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  // Cargar roles y tabla
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await (
        await import('../../../lib/supabaseClient')
      ).supabase
        .from('roles')
        .select('id,name')
        .order('name');

      if (!active) return;
      if (error) {
        showToastError(error.message);
      } else {
        setRoles((data ?? []) as Role[]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void reload(true); // filtros
  }, [includeInactive, selectedLocation, isSearching, searchTerm]);

  useEffect(() => {
    if (isSearching) return;
    void reload(false); // paginación
  }, [page]);

  // --- Acciones ----
  function openEdit(u: DbUser) {
    if (!canFull) {
      showToastError('No tienes permiso para editar usuarios.');
      return;
    }
    setForm({
      id: u.id,
      name: u.name ?? '',
      last_name: u.last_name ?? '',
      email: u.email ?? '',
      location: u.location ?? '',
      rol_id: u.rol_id ?? '',
      is_active: u.is_active,
    });
    setOpenForm(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!canFull) {
      showToastError('No tienes permiso para editar usuarios.');
      return;
    }
    if (
      !form.id ||
      !form.email.trim() ||
      !form.name.trim() ||
      !form.last_name.trim() ||
      !form.location
    ) {
      showToastError('Completa nombre, apellido, email y ubicación.');
      return;
    }
    setSubmitting(true);
    try {
      const patch: Partial<DbUser> = {
        name: form.name,
        last_name: form.last_name,
        email: form.email,
        location: form.location,
      };
      if (canManageRoles) {
        patch.rol_id = typeof form.rol_id === 'number' ? form.rol_id : null;
      }
      await updateUser(form.id, patch as DbUser);
      showToastSuccess('Usuario actualizado.');
      setOpenForm(false);
      await reload();
    } catch (e) {
      showToastError(extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  // SweetAlert2 de confirmación
  const confirmDialog = async (opts: {
    title: string;
    text: string;
    confirmText?: string;
  }) => {
    const { title, text, confirmText = 'Sí, continuar' } = opts;
    const res = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
      allowOutsideClick: () => !Swal.isLoading(),
      allowEscapeKey: true,
      focusCancel: true,
    });
    return res.isConfirmed;
  };

  async function handleToggleActive(u: DbUser) {
    if (!canCancel) {
      showToastError('No tienes permiso para activar/desactivar usuarios.');
      return;
    }

    const willDeactivate = u.is_active === true;
    if (willDeactivate) {
      const ok = await confirmDialog({
        title: 'Desactivar usuario',
        text: `¿Seguro que quieres desactivar a "${u.email}"? No podrá iniciar sesión hasta reactivarlo.`,
        confirmText: 'Sí, desactivar',
      });
      if (!ok) return;
    }

    setIsLoading(true);
    try {
      await setUserActive(u.id, !u.is_active);
      showToastSuccess(
        !u.is_active
          ? `Usuario activado: ${u.email}`
          : `Usuario desactivado: ${u.email}`
      );
      await reload();
    } catch (e) {
      showToastError(extractErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBulkDeactivate() {
    if (!canCancel) {
      showToastError('No tienes permiso para activar/desactivar usuarios.');
      return;
    }
    if (!selectedRows.length) return;

    const ok = await confirmDialog({
      title: 'Desactivar selección',
      text: `¿Desactivar ${selectedRows.length} usuario(s) seleccionado(s)?`,
      confirmText: 'Sí, desactivar',
    });
    if (!ok) return;

    setIsLoading(true);
    try {
      await bulkSetUserActive(
        selectedRows.map((r) => r.id),
        false
      );
      showToastSuccess(`Se desactivaron ${selectedRows.length} usuarios.`);
      setSelectedRows([]);
      await reload();
    } catch (e) {
      showToastError(extractErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(u: DbUser) {
    if (!canDelete) {
      showToastError('No tienes permiso para eliminar usuarios.');
      return;
    }

    const ok = await confirmDialog({
      title: 'Eliminar usuario',
      text: `¿Eliminar al usuario "${u.email}"? Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar',
    });
    if (!ok) return;

    setIsLoading(true);
    try {
      await deleteUser(u.id);
      showToastSuccess(`Usuario eliminado: ${u.email}`);
      await reload();
    } catch (e) {
      showToastError(extractErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  // Crear (con signUp + RPC)
  const resetCreate = () => {
    setNameC('');
    setLastNameC('');
    setEmailC('');
    setLocationC('');
    setPasswordC('');
    setRolIdC('');
    setMsgCreate(null);
  };
  const closeCreate = () => {
    setOpenCreate(false);
    resetCreate();
  };

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setMsgCreate(null);

    if (!nameC || !lastNameC || !emailC || !passwordC || !locationC) {
      setMsgCreate({ type: 'err', text: 'Completa todos los campos.' });
      return;
    }
    if (canManageRoles && !rolIdC) {
      setMsgCreate({ type: 'err', text: 'Selecciona un rol.' });
      return;
    }

    setSubmittingCreate(true);
    sessionStorage.setItem('admin:create-user:guard', '1');
    try {
      const { data: signUpRes, error: signUpErr } =
        await supabaseNoPersist.auth.signUp({
          email: emailC,
          password: passwordC,
          options: { data: { name: nameC } },
        });
      if (signUpErr) throw signUpErr;

      const newId = signUpRes.user?.id;
      if (!newId)
        throw new Error('No se obtuvo el ID del usuario creado en Auth.');

      const payload = {
        p_id: newId,
        p_email: emailC,
        p_name: nameC,
        p_last_name: lastNameC,
        p_location: locationC,
        p_rol_id: canManageRoles ? Number(rolIdC) : null,
      };

      const { error: rpcErr } = await (
        await import('../../../lib/supabaseClient')
      ).supabase.rpc('create_user_in_public', payload);

      if (rpcErr) throw rpcErr;

      await Promise.all([
        refreshAuth({ silent: true }),
        refreshUser({ silent: true }),
      ]);

      // ✅ Toast al crear
      showToastSuccess(`Usuario creado: ${emailC}`);

      setMsgCreate({ type: 'ok', text: 'Usuario creado correctamente.' });
      await reload(true);
      setTimeout(closeCreate, 700);
    } catch (err) {
      const msg = extractErrorMessage(err);
      setMsgCreate({ type: 'err', text: msg });
      showToastError(msg);
    } finally {
      setSubmittingCreate(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar superior */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm text-gray-700">
          <span className="mr-2">Ubicación:</span>
          <strong>{selectedLocation || 'TODAS'}</strong>
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
            onClick={() => setOpenCreate(true)}
            disabled={!canFull || !canManageRoles}
            title={
              !canFull
                ? 'No tienes permiso para crear/editar usuarios'
                : !canManageRoles
                ? 'No tienes permiso para asignar rol (rbac:manage_roles)'
                : undefined
            }
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Nuevo usuario
          </button>

          <button
            type="button"
            onClick={handleBulkDeactivate}
            disabled={selectedRows.length === 0 || isLoading || !canCancel}
            title={
              !canCancel
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

      {/* Lista / Tabla */}
      <div className="mt-3 flex-1 min-h-0">
        {/* ===== Vista Móvil: tarjetas ===== */}
        <div className="md:hidden space-y-3 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-gray-400">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-gray-400">Sin usuarios.</div>
          ) : (
            rows.map((u) => {
              const selected = selectedRows.includes(u);
              const roleName =
                roles.find((r) => r.id === u.rol_id)?.name ?? '—';
              return (
                <div
                  key={u.id}
                  className={cx(
                    'rounded-xl border bg-white p-4 shadow-sm cursor-pointer',
                    selected && 'ring-1 ring-indigo-300'
                  )}
                  onClick={() => setDetail(u)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      checked={selected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        if (!canCancel) return;
                        if (e.target.checked)
                          setSelectedRows((prev) => [...prev, u]);
                        else
                          setSelectedRows((prev) =>
                            prev.filter((x) => x !== u)
                          );
                      }}
                      disabled={!canCancel}
                      title={
                        !canCancel
                          ? 'No tienes permiso para seleccionar'
                          : undefined
                      }
                    />

                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-gray-900 line-clamp-1">
                        {u.name || u.last_name
                          ? `${u.name ?? ''} ${u.last_name ?? ''}`.trim()
                          : '—'}
                      </div>

                      <div className="mt-0.5 text-sm text-gray-600 line-clamp-1">
                        {u.email}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-slate-600">
                          <span className="text-slate-400">Rol:</span>{' '}
                          {roleName}
                        </span>
                        <ActiveChip active={u.is_active} />
                      </div>

                      <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          <span className="text-gray-400">Ubicación:</span>{' '}
                          {u.location || '—'}
                        </span>
                        <span>
                          <span className="text-gray-400">Creado:</span>{' '}
                          {formatDateInTimezone(
                            u.created_at,
                            'America/Santo_Domingo',
                            'display'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="mt-3 flex items-center justify-end gap-4">
                    <button
                      className="text-indigo-600 hover:text-indigo-500 text-sm cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetail(u);
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
                        openEdit(u);
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
                        void handleToggleActive(u);
                      }}
                    >
                      {u.is_active ? 'Desactivar' : 'Activar'}
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
                        void handleDelete(u);
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
                        disabled={!canCancel}
                        title={
                          !canCancel
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
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Apellido
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Ubicación
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Rol
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Creado
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
                        colSpan={9}
                        className="py-8 text-center text-gray-400"
                      >
                        Cargando…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-8 text-center text-gray-400"
                      >
                        Sin usuarios.
                      </td>
                    </tr>
                  ) : (
                    rows.map((u) => {
                      const selected = selectedRows.includes(u);
                      const roleName =
                        roles.find((r) => r.id === u.rol_id)?.name ?? '—';
                      return (
                        <tr
                          key={u.id}
                          className={cx(
                            'hover:bg-gray-50 transition cursor-pointer',
                            selected && 'bg-indigo-50'
                          )}
                          onClick={() => setDetail(u)}
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
                                  setSelectedRows((prev) => [...prev, u]);
                                else
                                  setSelectedRows((prev) =>
                                    prev.filter((x) => x !== u)
                                  );
                              }}
                              disabled={!canCancel}
                            />
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">
                            {u.name ?? '—'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">
                            {u.last_name ?? '—'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {u.email}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {u.location ?? '—'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {roleName}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <ActiveChip active={u.is_active} />
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {formatDateInTimezone(
                              u.created_at,
                              'America/Santo_Domingo',
                              'display'
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
                                onClick={() => openEdit(u)}
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
                                onClick={() => void handleToggleActive(u)}
                              >
                                {u.is_active ? 'Desactivar' : 'Activar'}
                              </button>
                              <button
                                className="text-rose-600 hover:text-rose-500 text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!canDelete}
                                title={
                                  !canDelete
                                    ? 'No tienes permiso para eliminar'
                                    : undefined
                                }
                                onClick={() => void handleDelete(u)}
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

      {/* Paginación */}
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
                <h2 className="text-lg font-semibold">Detalle del usuario</h2>
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
                    {detail.name ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Apellido</div>
                  <div className="text-gray-900">{detail.last_name ?? '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Email</div>
                  <div className="text-gray-900">{detail.email}</div>
                </div>
                <div>
                  <div className="text-gray-500">Ubicación</div>
                  <div className="text-gray-900">{detail.location ?? '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Estado</div>
                  <div className="text-gray-900">
                    <ActiveChip active={detail.is_active} />
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Creado</div>
                  <div className="text-gray-900">
                    {formatDateInTimezone(
                      detail.created_at,
                      'America/Santo_Domingo',
                      'display'
                    )}
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
                    openEdit(detail!);
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

      {/* Modal Crear usuario */}
      {openCreate && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/30" onClick={closeCreate} />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Crear usuario</h2>
                <button onClick={closeCreate} className="text-gray-500">
                  ✕
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Se creará en Auth y en public.users
              </p>

              <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre
                  </label>
                  <input
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={nameC}
                    onChange={(e) => setNameC(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Apellido
                  </label>
                  <input
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={lastNameC}
                    onChange={(e) => setLastNameC(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    maxLength={MAX_EMAIL_LENGTH}
                    placeholder="tuemail@cilm.do"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={emailC}
                    onChange={(e) => setEmailC(e.target.value)}
                    required
                  />
                  <div className="flex justify-between items-center">
                    {errors.email && (
                      <p className="text-sm text-red-500">{errors.email}</p>
                    )}
                    <p
                      className={`text-xs ml-auto ${
                        emailC.length >= Math.floor(MAX_EMAIL_LENGTH * 0.85)
                          ? 'text-red-500'
                          : 'text-gray-400'
                      }`}
                    >
                      {emailC.length}/{MAX_EMAIL_LENGTH} caracteres
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Ubicación
                  </label>
                  <select
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={locationC}
                    onChange={(e) => setLocationC(e.target.value)}
                    required
                  >
                    <option value="">Selecciona una ubicación…</option>
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    type="password"
                    minLength={8}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={passwordC}
                    onChange={(e) => setPasswordC(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Rol
                  </label>
                  <select
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={rolIdC}
                    onChange={(e) => setRolIdC(Number(e.target.value))}
                    required={canManageRoles}
                    disabled={!canManageRoles}
                    title={
                      !canManageRoles
                        ? 'No tienes permiso para asignar rol'
                        : undefined
                    }
                  >
                    <option value="">Selecciona un rol…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {msgCreate && (
                  <p
                    className={`text-sm ${
                      msgCreate.type === 'ok'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {msgCreate.text}
                  </p>
                )}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeCreate}
                    className="rounded-md border px-3 py-2 text-sm"
                    disabled={submittingCreate}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                    disabled={submittingCreate}
                  >
                    {submittingCreate ? 'Creando…' : 'Crear usuario'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar usuario */}
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
                  {isEditing ? 'Editar usuario' : 'Nuevo usuario'}
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
                    required
                  />
                </div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    required
                  />
                  <div className="flex justify-between items-center">
                    {errors.email && (
                      <p className="text-sm text-red-500">{errors.email}</p>
                    )}
                    <p
                      className={`text-xs ml-auto ${
                        form.email.length >= Math.floor(MAX_EMAIL_LENGTH * 0.85)
                          ? 'text-red-500'
                          : 'text-gray-400'
                      }`}
                    >
                      {form.email.length}/{MAX_EMAIL_LENGTH} caracteres
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Ubicación
                  </label>
                  <select
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.location}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, location: e.target.value }))
                    }
                    required
                  >
                    <option value="">Selecciona una ubicación…</option>
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Rol
                  </label>
                  <select
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={form.rol_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, rol_id: Number(e.target.value) }))
                    }
                    disabled={!canManageRoles}
                    title={
                      !canManageRoles
                        ? 'No tienes permiso para cambiar el rol'
                        : undefined
                    }
                  >
                    <option value="">Sin rol…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estado solo lectura (cambiar con botón dedicado) */}
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-600 cursor-not-allowed"
                    checked={form.is_active}
                    readOnly
                  />
                  Activo (usa el botón Activar/Desactivar)
                </label>

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
                        ? 'No tienes permiso para crear/editar usuarios'
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
