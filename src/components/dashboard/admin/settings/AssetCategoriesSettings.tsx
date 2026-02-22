import { useEffect, useMemo, useState } from 'react';
import { useCan } from '../../../../rbac/PermissionsContext';
import type {
  AssetCategory,
  AssetCategoryInsert,
  AssetCategoryUpdate,
} from '../../../../types/AssetCategory';
import {
  listAssetCategories,
  createAssetCategory,
  updateAssetCategory,
  toggleAssetCategoryActive,
  deleteAssetCategory,
} from '../../../../services/assetCategoryService';
import { showConfirmAlert } from '../../../../notifications';
import {
  showToastError,
  showToastSuccess,
} from '../../../../notifications/toast';

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Mode = 'create' | 'edit';

const EMPTY_FORM: AssetCategoryInsert = {
  name: '',
  description: null,
  is_active: true,
};

export default function AssetCategoriesSettings() {
  const canReadPerm = useCan('assets:read');
  const canFull = useCan('assets:full_access');

  // Para categorías: solo full_access gestiona, pero leer se permite con read/full_access
  const canRead = canReadPerm || canFull;
  const canManage = canFull;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssetCategory[]>([]);
  const [includeInactive, setIncludeInactive] = useState(true);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('create');
  const [editing, setEditing] = useState<AssetCategory | null>(null);

  const [form, setForm] = useState<AssetCategoryInsert>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const disabled = useMemo(
    () => loading || submitting || !canRead,
    [loading, submitting, canRead]
  );

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await listAssetCategories({ includeInactive });
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
    void fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, includeInactive]);

  const openCreate = () => {
    setMode('create');
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (cat: AssetCategory) => {
    setMode('edit');
    setEditing(cat);
    setForm({
      name: cat.name,
      description: cat.description ?? null,
      is_active: cat.is_active,
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

      const payload: AssetCategoryInsert = {
        name: form.name.trim(),
        description: form.description ?? null,
        is_active: form.is_active ?? true,
      };

      if (!payload.name) throw new Error('El nombre es requerido.');

      if (mode === 'create') {
        if (!canManage) throw new Error('No autorizado para crear categorías.');
        await createAssetCategory(payload);
        showToastSuccess('Categoría creada.');
      } else {
        if (!canManage)
          throw new Error('No autorizado para editar categorías.');
        if (!editing) throw new Error('No hay categoría seleccionada.');

        const patch: AssetCategoryUpdate = {
          name: payload.name,
          description: payload.description,
          is_active: payload.is_active,
        };

        await updateAssetCategory(editing.id, patch);
        showToastSuccess('Categoría actualizada.');
      }

      setOpen(false);
      await fetchCategories();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onToggleActive = async (cat: AssetCategory) => {
    try {
      if (!canManage)
        throw new Error('No autorizado para activar/inactivar categorías.');
      if (cat.is_active) {
        const ok = await showConfirmAlert({
          title: 'Inactivar categoría',
          text: `¿Inactivar la categoría "${cat.name}"?`,
          confirmButtonText: 'Sí, inactivar',
        });
        if (!ok) return;
      }

      setSubmitting(true);
      await toggleAssetCategoryActive(cat.id, !cat.is_active);
      showToastSuccess(
        cat.is_active ? 'Categoría inactivada.' : 'Categoría activada.'
      );
      await fetchCategories();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (cat: AssetCategory) => {
    try {
      if (!canManage)
        throw new Error('No autorizado para eliminar categorías.');

      const ok = await showConfirmAlert({
        title: 'Eliminar categoría',
        text: `¿Eliminar la categoría "${cat.name}"? Esta acción no se puede deshacer.`,
        confirmButtonText: 'Sí, eliminar',
      });
      if (!ok) return;

      setSubmitting(true);
      await deleteAssetCategory(cat.id);
      showToastSuccess('Categoría eliminada.');
      await fetchCategories();
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
        No tienes permiso para ver categorías de activos.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 rounded-2xl border bg-white shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Categorías</h2>
          <p className="text-sm text-gray-500">
            Crea, edita y gestiona categorías activas/inactivas para los
            activos.
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

          {canManage && (
            <button
              onClick={openCreate}
              disabled={disabled}
              className={cx(
                'px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              + Nueva categoría
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
                <th className="text-left font-medium px-4 py-3">Estado</th>
                <th className="text-right font-medium px-4 py-3">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={3}>
                    Cargando categorías…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={3}>
                    No hay categorías registradas.
                  </td>
                </tr>
              ) : (
                rows.map((cat) => (
                  <tr key={cat.id} className="bg-white">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {cat.name}
                      </div>
                      {cat.description ? (
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {cat.description}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={cx(
                          'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                          cat.is_active
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {cat.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canManage && (
                          <>
                            <button
                              onClick={() => openEdit(cat)}
                              disabled={disabled}
                              className={cx(
                                'px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50',
                                disabled && 'opacity-60 cursor-not-allowed'
                              )}
                            >
                              Editar
                            </button>

                            <button
                              onClick={() => void onToggleActive(cat)}
                              disabled={disabled}
                              className={cx(
                                'px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50',
                                disabled && 'opacity-60 cursor-not-allowed'
                              )}
                            >
                              {cat.is_active ? 'Inactivar' : 'Activar'}
                            </button>

                            <button
                              onClick={() => void onDelete(cat)}
                              disabled={disabled}
                              className={cx(
                                'px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50',
                                disabled && 'opacity-60 cursor-not-allowed'
                              )}
                            >
                              Eliminar
                            </button>
                          </>
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
                    {mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    El nombre debe ser único.
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
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  disabled={submitting}
                  className="border rounded-lg px-3 py-2 w-full disabled:bg-gray-100"
                  placeholder="Ej: HVAC"
                />
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
                  placeholder="Notas o detalles de la categoría…"
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
