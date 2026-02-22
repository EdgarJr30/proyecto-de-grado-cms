import { useEffect, useMemo, useState } from 'react';
import { useCan } from '../../../../rbac/PermissionsContext';
import type {
  Location,
  LocationInsert,
  LocationUpdate,
} from '../../../../types/Location';
import {
  listLocations,
  createLocation,
  updateLocation,
  toggleLocationActive,
  deleteLocation,
} from '../../../../services/locationService';
import { showConfirmAlert } from '../../../../notifications';
import {
  showToastError,
  showToastSuccess,
} from '../../../../notifications/toast';

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Mode = 'create' | 'edit';

const EMPTY_FORM: LocationInsert = {
  name: '',
  code: '',
  description: null,
  is_active: true,
};

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export default function LocationsSettings() {
  const canReadPerm = useCan('locations:read');
  const canFull = useCan('locations:full_access');
  const canDisablePerm = useCan('locations:disable');
  const canDeletePerm = useCan('locations:delete');

  const canRead = canReadPerm || canFull;
  const canDisable = canDisablePerm || canFull;
  const canDelete = canDeletePerm || canFull;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Location[]>([]);
  const [includeInactive, setIncludeInactive] = useState(true);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('create');
  const [editing, setEditing] = useState<Location | null>(null);

  const [form, setForm] = useState<LocationInsert>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // ✅ Disabled incluye !canRead (consistente)
  const disabled = useMemo(
    () => loading || submitting || !canRead,
    [loading, submitting, canRead]
  );

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const data = await listLocations({ includeInactive });
      setRows(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToastError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canRead) return;
    void fetchLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, includeInactive]);

  const openCreate = () => {
    setMode('create');
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (loc: Location) => {
    setMode('edit');
    setEditing(loc);
    setForm({
      name: loc.name,
      code: loc.code,
      description: loc.description ?? null,
      is_active: loc.is_active,
    });
    setOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setOpen(false);
  };

  const onSubmit = async () => {
    try {
      setSubmitting(true);

      const payload: LocationInsert = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description ?? null,
        is_active: form.is_active ?? true,
      };

      if (!payload.name) throw new Error('El nombre es requerido.');
      if (!payload.code) throw new Error('El código es requerido.');

      if (mode === 'create') {
        if (!canFull) throw new Error('No autorizado para crear ubicaciones.');
        await createLocation(payload);
        showToastSuccess('Ubicación creada.');
      } else {
        if (!canFull) throw new Error('No autorizado para editar ubicaciones.');
        if (!editing) throw new Error('No hay ubicación seleccionada.');

        const patch: LocationUpdate = {
          name: payload.name,
          code: payload.code,
          description: payload.description,
          is_active: payload.is_active,
        };

        await updateLocation(editing.id, patch);
        showToastSuccess('Ubicación actualizada.');
      }

      setOpen(false);
      await fetchLocations();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onToggleActive = async (loc: Location) => {
    try {
      if (!canDisable)
        throw new Error('No autorizado para activar/inactivar ubicaciones.');
      if (loc.is_active) {
        const ok = await showConfirmAlert({
          title: 'Inactivar ubicación',
          text: `¿Inactivar la ubicación "${loc.name}"?`,
          confirmButtonText: 'Sí, inactivar',
        });
        if (!ok) return;
      }

      setSubmitting(true);
      await toggleLocationActive(loc.id, !loc.is_active);
      showToastSuccess(
        loc.is_active ? 'Ubicación inactivada.' : 'Ubicación activada.'
      );
      await fetchLocations();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (loc: Location) => {
    try {
      if (!canDelete)
        throw new Error('No autorizado para eliminar ubicaciones.');

      const ok = await showConfirmAlert({
        title: 'Eliminar ubicación',
        text: `¿Eliminar la ubicación "${loc.name}"? Esta acción no se puede deshacer.`,
        confirmButtonText: 'Sí, eliminar',
      });
      if (!ok) return;

      setSubmitting(true);
      await deleteLocation(loc.id);
      showToastSuccess('Ubicación eliminada.');
      await fetchLocations();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canRead) {
    return (
      <div className="p-4 md:p-6 rounded-2xl border bg-white shadow-sm">
        No tienes permiso para ver ubicaciones.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 rounded-2xl border bg-white shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Ubicaciones</h2>
          <p className="text-sm text-gray-500">
            Crea, edita y gestiona ubicaciones activas/inactivas.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              disabled={disabled}
            />
            Ver inactivas
          </label>

          {canFull && (
            <button
              onClick={openCreate}
              disabled={disabled}
              className={cx(
                'px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              + Nueva ubicación
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-medium px-4 py-3">Nombre</th>
                <th className="text-left font-medium px-4 py-3">Código</th>
                <th className="text-left font-medium px-4 py-3">Estado</th>
                <th className="text-right font-medium px-4 py-3">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={4}>
                    Cargando ubicaciones…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={4}>
                    No hay ubicaciones registradas.
                  </td>
                </tr>
              ) : (
                rows.map((loc) => (
                  <tr key={loc.id} className="bg-white">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {loc.name}
                      </div>
                      {loc.description ? (
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {loc.description}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 rounded px-2 py-1">
                        {loc.code}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={cx(
                          'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                          loc.is_active
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {loc.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canFull && (
                          <button
                            onClick={() => openEdit(loc)}
                            disabled={disabled}
                            className={cx(
                              'px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50',
                              disabled && 'opacity-60 cursor-not-allowed'
                            )}
                          >
                            Editar
                          </button>
                        )}

                        {canDisable && (
                          <button
                            onClick={() => void onToggleActive(loc)}
                            disabled={disabled}
                            className={cx(
                              'px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50',
                              disabled && 'opacity-60 cursor-not-allowed'
                            )}
                          >
                            {loc.is_active ? 'Inactivar' : 'Activar'}
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() => void onDelete(loc)}
                            disabled={disabled}
                            className={cx(
                              'px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50',
                              disabled && 'opacity-60 cursor-not-allowed'
                            )}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeModal}
            role="button"
            tabIndex={-1}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl border">
            <div className="p-5 border-b">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">
                    {mode === 'create' ? 'Nueva ubicación' : 'Editar ubicación'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    El código debe ser único (ej:{' '}
                    <span className="font-mono">adrian_tropical_27</span>).
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  disabled={submitting}
                  className={cx(
                    'rounded-lg px-3 py-1 border bg-white hover:bg-gray-50',
                    submitting && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((p) => ({
                      ...p,
                      name,
                      code:
                        mode === 'create'
                          ? p.code
                            ? p.code
                            : slugify(name)
                          : p.code,
                    }));
                  }}
                  disabled={submitting}
                  className="border rounded-lg px-3 py-2 w-full disabled:bg-gray-100"
                  placeholder="Ej: Adrian Tropical 27"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Código</label>
                <input
                  value={form.code}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, code: slugify(e.target.value) }))
                  }
                  disabled={submitting}
                  className="border rounded-lg px-3 py-2 w-full font-mono disabled:bg-gray-100"
                  placeholder="Ej: adrian_tropical_27"
                />
                <p className="text-xs text-gray-500">
                  Solo letras/números/guión bajo. Se normaliza automáticamente.
                </p>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Descripción (opcional)
                </label>
                <textarea
                  value={form.description ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      description: e.target.value || null,
                    }))
                  }
                  disabled={submitting}
                  className="border rounded-lg px-3 py-2 w-full min-h-[90px] disabled:bg-gray-100"
                  placeholder="Notas o detalles de la ubicación…"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_active)}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, is_active: e.target.checked }))
                  }
                  disabled={submitting}
                />
                Activa
              </label>
            </div>

            <div className="p-5 border-t flex gap-2 justify-end">
              <button
                onClick={closeModal}
                disabled={submitting}
                className={cx(
                  'px-4 py-2 rounded-lg border bg-white hover:bg-gray-50',
                  submitting && 'opacity-60 cursor-not-allowed'
                )}
              >
                Cancelar
              </button>
              <button
                onClick={() => void onSubmit()}
                disabled={submitting}
                className={cx(
                  'px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700',
                  submitting && 'opacity-60 cursor-not-allowed'
                )}
              >
                {submitting ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
