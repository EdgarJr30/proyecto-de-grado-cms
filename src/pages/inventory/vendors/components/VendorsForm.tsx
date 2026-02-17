import type { VendorInsert } from '../../../../types/inventory';
import { GhostButton, PrimaryButton } from './buttons';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function VendorsForm({
  form,
  isReadOnly,
  isEditing,
  onChangeForm,
  onCancel,
  onSubmit,
}: {
  form: VendorInsert;
  isReadOnly: boolean;
  isEditing: boolean;
  onChangeForm: (patch: Partial<VendorInsert>) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const disabledClasses = isReadOnly
    ? 'opacity-50 cursor-not-allowed bg-slate-100'
    : '';

  return (
    <form
      onSubmit={onSubmit}
      className={cx(
        'rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden',
        isReadOnly && 'opacity-75'
      )}
    >
      <div className="h-10 border-b border-slate-200 bg-blue-50/60" />

      <div className="-mt-5 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Nombre</label>
            <input
              value={form.name}
              disabled={isReadOnly}
              onChange={(e) => onChangeForm({ name: e.target.value })}
              className={cx(
                'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm',
                disabledClasses
              )}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              value={form.email ?? ''}
              disabled={isReadOnly}
              onChange={(e) => onChangeForm({ email: e.target.value })}
              className={cx(
                'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm',
                disabledClasses
              )}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Teléfono
            </label>
            <input
              value={form.phone ?? ''}
              disabled={isReadOnly}
              onChange={(e) => onChangeForm({ phone: e.target.value })}
              className={cx(
                'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm',
                disabledClasses
              )}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <label className="text-sm inline-flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active ?? true}
              disabled={isReadOnly}
              onChange={(e) => onChangeForm({ is_active: e.target.checked })}
            />
            Activo
          </label>

          <div className="flex items-center gap-2 justify-end">
            {isEditing ? (
              <GhostButton onClick={onCancel} disabled={isReadOnly}>
                Cancelar
              </GhostButton>
            ) : null}

            <PrimaryButton type="submit" disabled={isReadOnly}>
              {isEditing ? 'Guardar' : 'Crear'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </form>
  );
}
