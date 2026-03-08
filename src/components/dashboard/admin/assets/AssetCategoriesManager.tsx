import { useEffect, useMemo, useState } from 'react';
import { useCan } from '../../../../rbac/PermissionsContext';
import type {
  AssetCategory,
  AssetCategoryInsert,
  AssetCategoryUpdate,
} from '../../../../types/AssetCategory';
import {
  createAssetCategory,
  deleteAssetCategory,
  listAssetCategories,
  toggleAssetCategoryActive,
  updateAssetCategory,
} from '../../../../services/assetCategoryService';
import { showConfirmAlert } from '../../../../notifications';
import {
  showToastError,
  showToastSuccess,
} from '../../../../notifications/toast';
import AnimatedDialog from '../../../ui/AnimatedDialog';

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Mode = 'create' | 'edit';

const EMPTY_FORM: AssetCategoryInsert = {
  name: '',
  description: null,
  is_active: true,
};

export default function AssetCategoriesManager() {
  const canManage = useCan('inventory:full_access');

  const [open, setOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AssetCategory[]>([]);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [mode, setMode] = useState<Mode>('create');
  const [editing, setEditing] = useState<AssetCategory | null>(null);
  const [form, setForm] = useState<AssetCategoryInsert>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const disabled = useMemo(
    () => loading || submitting || !canManage,
    [loading, submitting, canManage]
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
    if (!open || !canManage) return;
    void fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, includeInactive, canManage]);

  const openCreate = () => {
    setMode('create');
    setEditing(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };

  const openEdit = (category: AssetCategory) => {
    setMode('edit');
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description ?? null,
      is_active: category.is_active,
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (submitting) return;
    setEditorOpen(false);
  };

  const closeManager = () => {
    if (submitting) return;
    setEditorOpen(false);
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
        await createAssetCategory(payload);
        showToastSuccess('Categoría creada.');
      } else {
        if (!editing) throw new Error('No hay categoría seleccionada.');

        const patch: AssetCategoryUpdate = {
          name: payload.name,
          description: payload.description,
          is_active: payload.is_active,
        };

        await updateAssetCategory(editing.id, patch);
        showToastSuccess('Categoría actualizada.');
      }

      setEditorOpen(false);
      await fetchCategories();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onToggleActive = async (category: AssetCategory) => {
    try {
      if (category.is_active) {
        const ok = await showConfirmAlert({
          title: 'Inactivar categoría',
          text: `¿Inactivar la categoría "${category.name}"?`,
          confirmButtonText: 'Sí, inactivar',
        });
        if (!ok) return;
      }

      setSubmitting(true);
      await toggleAssetCategoryActive(category.id, !category.is_active);
      showToastSuccess(
        category.is_active ? 'Categoría inactivada.' : 'Categoría activada.'
      );
      await fetchCategories();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (category: AssetCategory) => {
    try {
      const ok = await showConfirmAlert({
        title: 'Eliminar categoría',
        text: `¿Eliminar la categoría "${category.name}"? Esta acción no se puede deshacer.`,
        confirmButtonText: 'Sí, eliminar',
      });
      if (!ok) return;

      setSubmitting(true);
      await deleteAssetCategory(category.id);
      showToastSuccess('Categoría eliminada.');
      await fetchCategories();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canManage) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Categorías de activos
      </button>

      <AnimatedDialog
        open={open}
        onClose={closeManager}
        lockScroll
        overlayClassName="bg-slate-950/55 backdrop-blur-[3px]"
        containerClassName="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
        panelClassName="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Categorías de activos
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Crea, edita y gestiona las categorías usadas por los activos
                fijos.
              </p>
            </div>

            <button
              type="button"
              onClick={closeManager}
              disabled={submitting}
              className={cx(
                'inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50',
                submitting && 'cursor-not-allowed opacity-60'
              )}
              aria-label="Cerrar"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
                disabled={disabled}
              />
              Ver inactivas
            </label>

            <button
              type="button"
              onClick={openCreate}
              disabled={disabled}
              className={cx(
                'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              + Nueva categoría
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={3}>
                        Cargando categorías...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={3}>
                        No hay categorías registradas.
                      </td>
                    </tr>
                  ) : (
                    rows.map((category) => (
                      <tr key={category.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {category.name}
                          </div>
                          {category.description ? (
                            <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                              {category.description}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={cx(
                              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                              category.is_active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {category.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(category)}
                              disabled={disabled}
                              className={cx(
                                'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 transition hover:bg-slate-50',
                                disabled && 'cursor-not-allowed opacity-60'
                              )}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => void onToggleActive(category)}
                              disabled={disabled}
                              className={cx(
                                'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 transition hover:bg-slate-50',
                                disabled && 'cursor-not-allowed opacity-60'
                              )}
                            >
                              {category.is_active ? 'Inactivar' : 'Activar'}
                            </button>

                            <button
                              type="button"
                              onClick={() => void onDelete(category)}
                              disabled={disabled}
                              className={cx(
                                'rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-rose-600 transition hover:bg-rose-50',
                                disabled && 'cursor-not-allowed opacity-60'
                              )}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <AnimatedDialog
          open={editorOpen}
          onClose={closeEditor}
          lockScroll
          overlayClassName="bg-slate-950/45 backdrop-blur-[2px]"
          panelClassName="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">
                  {mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  El nombre debe ser único.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={submitting}
                className={cx(
                  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50',
                  submitting && 'cursor-not-allowed opacity-60'
                )}
                aria-label="Cerrar"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Nombre
              </label>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                disabled={submitting}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                placeholder="Ej: HVAC"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Descripción (opcional)
              </label>
              <textarea
                value={form.description ?? ''}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value || null,
                  }))
                }
                disabled={submitting}
                className="min-h-[96px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                placeholder="Notas o detalles de la categoría..."
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(form.is_active)}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    is_active: event.target.checked,
                  }))
                }
                disabled={submitting}
              />
              Activa
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
            <button
              type="button"
              onClick={closeEditor}
              disabled={submitting}
              className={cx(
                'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50',
                submitting && 'cursor-not-allowed opacity-60'
              )}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={submitting}
              className={cx(
                'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500',
                submitting && 'cursor-not-allowed opacity-60'
              )}
            >
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </AnimatedDialog>
      </AnimatedDialog>
    </>
  );
}
