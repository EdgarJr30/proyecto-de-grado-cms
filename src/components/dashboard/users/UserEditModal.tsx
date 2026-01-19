import { useEffect, useMemo, useState } from 'react';
import { showToastError, showToastSuccess } from '../../../notifications';
import { updateUser, type DbUser } from '../../../services/userAdminService';
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
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = useMemo(() => Boolean(form.id), [form.id]);

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
  }, [open, user]);

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
            <button onClick={onClose} className="text-gray-500">
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
