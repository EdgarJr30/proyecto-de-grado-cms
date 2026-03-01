import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../../../context/UserContext';
import { showToastError, showToastSuccess } from '../../../notifications';
import {
  getUserIdentityById,
  getUserPasswordResetAuditById,
  resetUserPassword,
  updateUser,
  type DbUser,
} from '../../../services/userAdminService';
import PasswordInput from '../../ui/password-input';
import { generateSecurePassword } from '../../../utils/passwordGenerator';
import { formatDateInTimezone } from '../../../utils/formatDate';
import { MAX_EMAIL_LENGTH } from '../../../utils/validators';

interface Role {
  id: number;
  name: string;
}

type DbLocation = {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

// Helper seguro para extraer mensajes de error
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
  location_id: number | null;
  rol_id: number | '';
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  last_name: '',
  email: '',
  location_id: null,
  rol_id: '',
  is_active: true,
};

type Props = {
  open: boolean;
  user: DbUser | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;

  roles: Role[];
  locations: DbLocation[];
  loadingLocations: boolean;

  canFull: boolean;
  canManageRoles: boolean;
};

export default function UserEditModal({
  open,
  user,
  onClose,
  onSaved,
  roles,
  locations,
  loadingLocations,
  canFull,
  canManageRoles,
}: Props) {
  const { profile } = useUser();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [lastResetAt, setLastResetAt] = useState<string | null>(null);
  const [lastResetById, setLastResetById] = useState<string | null>(null);
  const [lastResetByName, setLastResetByName] = useState<string | null>(null);
  const [lastResetByEmail, setLastResetByEmail] = useState<string | null>(null);
  const [updatedAtInfo, setUpdatedAtInfo] = useState<string | null>(null);
  const [loadingResetActor, setLoadingResetActor] = useState(false);

  const isEditing = useMemo(() => Boolean(form.id), [form.id]);
  const resetActorLabel = useMemo(() => {
    if (loadingResetActor) return 'Cargando…';
    const fullName = (lastResetByName ?? '').trim();
    const email = (lastResetByEmail ?? '').trim();
    if (fullName && email) return `${fullName} (${email})`;
    if (fullName) return fullName;
    if (email) return email;
    if (lastResetById) return lastResetById;
    return '—';
  }, [
    loadingResetActor,
    lastResetByName,
    lastResetByEmail,
    lastResetById,
  ]);

  // Cargar usuario en el formulario cuando abra
  useEffect(() => {
    if (!open) return;
    if (!user) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      id: user.id,
      name: user.name ?? '',
      last_name: user.last_name ?? '',
      email: user.email ?? '',
      location_id: user.location_id ?? null,
      rol_id: user.rol_id ?? '',
      is_active: user.is_active,
    });
    setGeneratedPassword('');
    setLastResetAt(user.password_reset_at ?? null);
    setLastResetById(user.password_reset_by ?? null);
    setLastResetByName(null);
    setLastResetByEmail(null);
    setUpdatedAtInfo(user.updated_at ?? null);
  }, [open, user]);

  useEffect(() => {
    if (!open || !lastResetById) return;
    if (lastResetByName || lastResetByEmail) return;

    let active = true;
    setLoadingResetActor(true);
    (async () => {
      try {
        const actor = await getUserIdentityById(lastResetById);
        if (!active || !actor) return;
        const fullName = `${actor.name ?? ''} ${actor.last_name ?? ''}`.trim();
        setLastResetByName(fullName || null);
        setLastResetByEmail(actor.email ?? null);
      } catch {
        if (!active) return;
      } finally {
        if (active) setLoadingResetActor(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, lastResetById, lastResetByName, lastResetByEmail]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const errors: Partial<Record<keyof FormState, string>> = {};

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();

    if (!canFull) {
      showToastError('No tienes permiso para editar usuarios.');
      return;
    }
    if (!form.id) {
      showToastError('No se pudo determinar el usuario a editar.');
      return;
    }
    if (!form.email.trim() || !form.name.trim() || !form.last_name.trim()) {
      showToastError('Completa nombre, apellido y email.');
      return;
    }

    setSubmitting(true);
    try {
      const patch: Partial<DbUser> = {
        name: form.name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        location_id: form.location_id,
      };

      // Solo si puede administrar roles
      if (canManageRoles) {
        patch.rol_id = typeof form.rol_id === 'number' ? form.rol_id : null;
      }

      await updateUser(form.id, patch as DbUser);
      showToastSuccess('Usuario actualizado.');
      onClose();
      await onSaved();
    } catch (err: unknown) {
      showToastError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!canFull) {
      showToastError('No tienes permiso para resetear contraseñas.');
      return;
    }
    if (!form.id) {
      showToastError('No se pudo determinar el usuario.');
      return;
    }

    let nextPassword = '';
    try {
      nextPassword = generateSecurePassword();
    } catch {
      showToastError('No se pudo generar una contraseña segura.');
      return;
    }

    setResettingPassword(true);
    try {
      await resetUserPassword(form.id, nextPassword);
      setGeneratedPassword(nextPassword);
      const persistedAudit = await getUserPasswordResetAuditById(form.id);
      if (persistedAudit) {
        setLastResetAt(persistedAudit.password_reset_at ?? null);
        setUpdatedAtInfo(persistedAudit.updated_at ?? null);
        setLastResetById(persistedAudit.password_reset_by ?? null);
        setLastResetByName(null);
        setLastResetByEmail(null);
      } else {
        // Fallback de compatibilidad para BD sin columnas nuevas.
        const nowIso = new Date().toISOString();
        const actorName = `${profile?.name ?? ''} ${profile?.last_name ?? ''}`.trim();
        setLastResetAt(nowIso);
        setUpdatedAtInfo(nowIso);
        setLastResetById(profile?.id ?? null);
        setLastResetByName(actorName || null);
        setLastResetByEmail(profile?.email ?? null);
      }
      showToastSuccess('Contraseña reseteada y generada correctamente.');
      await onSaved();
    } catch (err: unknown) {
      showToastError(extractErrorMessage(err));
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleCopyGeneratedPassword() {
    if (!generatedPassword) return;

    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        await navigator.clipboard.writeText(generatedPassword);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = generatedPassword;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!ok) throw new Error('No se pudo copiar');
      } else {
        throw new Error('No se pudo copiar');
      }

      showToastSuccess('Contraseña copiada al portapapeles.');
    } catch {
      showToastError('No se pudo copiar la contraseña.');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {isEditing ? 'Editar usuario' : 'Usuario'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500"
              aria-label="Cerrar"
              title="Cerrar"
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
                maxLength={MAX_EMAIL_LENGTH}
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
                  className={cx(
                    'text-xs ml-auto',
                    form.email.length >= Math.floor(MAX_EMAIL_LENGTH * 0.85)
                      ? 'text-red-500'
                      : 'text-gray-400'
                  )}
                >
                  {form.email.length}/{MAX_EMAIL_LENGTH} caracteres
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Ubicación{' '}
                <span className="text-xs text-gray-400">(opcional)</span>
              </label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={form.location_id ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    location_id: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                disabled={loadingLocations}
              >
                <option value="">
                  {loadingLocations ? 'Cargando ubicaciones…' : 'Sin ubicación'}
                </option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
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
                  setForm((f) => ({
                    ...f,
                    rol_id: e.target.value ? Number(e.target.value) : '',
                  }))
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

            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-indigo-900">
                    Resetear contraseña
                  </p>
                  <p className="mt-1 text-xs text-indigo-800">
                    Genera una contraseña temporal sin pedir la contraseña
                    anterior.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleResetPassword()}
                  disabled={resettingPassword || submitting || !canFull || !form.id}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                  title={
                    !canFull
                      ? 'No tienes permiso para resetear contraseñas'
                      : undefined
                  }
                >
                  {resettingPassword ? 'Reseteando…' : 'Resetear y generar'}
                </button>
              </div>

              {generatedPassword && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-indigo-900">
                    Nueva contraseña temporal
                  </label>
                  <PasswordInput
                    value={generatedPassword}
                    readOnly
                    autoComplete="off"
                    className="mt-1 block w-full rounded-md border-indigo-200 bg-white text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleCopyGeneratedPassword()}
                      className="rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-50"
                    >
                      Copiar contraseña
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-3 grid gap-1 text-xs text-indigo-900">
                <p>
                  Último reseteo:{' '}
                  <strong>
                    {lastResetAt
                      ? formatDateInTimezone(
                          lastResetAt,
                          'America/Santo_Domingo',
                          'display'
                        )
                      : 'Nunca'}
                  </strong>
                </p>
                <p>
                  Reseteado por: <strong>{resetActorLabel}</strong>
                </p>
                <p>
                  Última actualización:{' '}
                  <strong>
                    {updatedAtInfo
                      ? formatDateInTimezone(
                          updatedAtInfo,
                          'America/Santo_Domingo',
                          'display'
                        )
                      : '—'}
                  </strong>
                </p>
              </div>
            </div>

            {/* Estado solo lectura */}
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
                onClick={onClose}
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
                {submitting ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
