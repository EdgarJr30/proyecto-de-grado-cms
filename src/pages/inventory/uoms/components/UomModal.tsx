import type { FormState } from './types';
import { GhostButton, PrimaryButton } from './buttons';
import { ArrowRight } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      className={cx(
        'mt-1 block w-full rounded-xl border px-3 py-2 text-sm shadow-sm transition',
        'border-slate-200 bg-white text-slate-900',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300',
        disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
        className
      )}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

export function UomModal({
  open,
  isEditing,
  form,
  submitting,
  canManage,
  onClose,
  onChangeForm,
  onSubmit,
}: {
  open: boolean;
  isEditing: boolean;
  form: FormState;
  submitting: boolean;
  canManage: boolean;
  onClose: () => void;
  onChangeForm: (patch: Partial<FormState>) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {/* top tint bar */}
          <div className="h-10 border-b border-slate-200 bg-indigo-50/60" />

          <div className="p-5 -mt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900">
                  {isEditing ? 'Editar UdM' : 'Nueva UdM'}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Define un código corto y un nombre descriptivo.
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="sm:col-span-2">
                  <FieldLabel>Código</FieldLabel>
                  <TextInput
                    value={form.code}
                    onChange={(v) => onChangeForm({ code: v })}
                    placeholder="EA, UND, LB…"
                    disabled={submitting}
                    className="font-mono"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Se guardará en mayúsculas.
                  </p>
                </div>

                <div className="sm:col-span-3">
                  <FieldLabel>Nombre</FieldLabel>
                  <TextInput
                    value={form.name}
                    onChange={(v) => onChangeForm({ name: v })}
                    placeholder="Unidad, Libra…"
                    disabled={submitting}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Tip: usa nombres consistentes (singular).
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <GhostButton onClick={onClose} disabled={submitting}>
                  Cancelar
                </GhostButton>

                <PrimaryButton
                  type="submit"
                  disabled={submitting || !canManage}
                  title={
                    !canManage
                      ? 'No tienes permiso para gestionar maestros'
                      : undefined
                  }
                  icon={ArrowRight}
                >
                  {submitting
                    ? 'Guardando…'
                    : isEditing
                      ? 'Guardar cambios'
                      : 'Crear'}
                </PrimaryButton>
              </div>

              {!canManage ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
                  No tienes permiso para gestionar maestros (solo lectura).
                </div>
              ) : null}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
