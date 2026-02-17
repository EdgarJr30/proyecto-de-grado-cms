import type { FormState } from './types';
import { GhostButton, PrimaryButton } from './buttons';

export function WarehouseModal({
  open,
  editing,
  form,
  saving,
  canManage,
  onClose,
  onChangeForm,
  onSave,
}: {
  open: boolean;
  editing: boolean;
  form: FormState;
  saving: boolean;
  canManage: boolean;
  onClose: () => void;
  onChangeForm: (patch: Partial<FormState>) => void;
  onSave: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="h-10 border-b border-slate-200 bg-slate-50" />

        <div className="p-5 -mt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {editing ? 'Editar warehouse' : 'Nuevo warehouse'}
              </h3>
              <p className="text-sm text-slate-500">Code debe ser único.</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              aria-label="Cerrar"
            >
              x
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-slate-700">Code</span>
              <input
                value={form.code}
                onChange={(e) => onChangeForm({ code: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-500/20"
              />
            </label>

            <label className="text-sm">
              <span className="text-slate-700">Name</span>
              <input
                value={form.name}
                onChange={(e) => onChangeForm({ name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-500/20"
              />
            </label>

            <label className="text-sm md:col-span-2">
              <span className="text-slate-700">Location label (opcional)</span>
              <input
                value={form.location_label}
                onChange={(e) =>
                  onChangeForm({ location_label: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-500/20"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={form.is_active}
                onChange={(e) => onChangeForm({ is_active: e.target.checked })}
              />
              Activo
            </label>
          </div>

          <div className="pt-5 flex justify-end gap-2">
            <GhostButton onClick={onClose}>Cancelar</GhostButton>
            <PrimaryButton
              disabled={!canManage || saving}
              onClick={onSave}
              title={!canManage ? 'No tienes permisos para gestionar almacenes' : undefined}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
