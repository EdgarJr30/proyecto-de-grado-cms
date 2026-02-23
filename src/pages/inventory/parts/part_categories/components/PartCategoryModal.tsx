import { useEffect } from 'react';
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      className={cx(
        'mt-1 block w-full rounded-xl border px-3 py-2 text-sm shadow-sm transition',
        'border-slate-200 bg-white text-slate-900',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300',
        disabled && 'opacity-60 cursor-not-allowed bg-slate-50'
      )}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      className={cx(
        'mt-1 block w-full rounded-xl border px-3 py-2 text-sm shadow-sm transition',
        'border-slate-200 bg-white text-slate-900',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300',
        disabled && 'opacity-60 cursor-not-allowed bg-slate-50'
      )}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {children}
    </select>
  );
}

export function PartCategoryModal({
  open,
  isEditing,
  form,
  parentOptions,
  submitting,
  canManage,
  onClose,
  onChangeForm,
  onSubmit,
}: {
  open: boolean;
  isEditing: boolean;
  form: FormState;
  parentOptions: Array<{ id: string; name: string }>;
  submitting: boolean;
  canManage: boolean;
  onClose: () => void;
  onChangeForm: (patch: Partial<FormState>) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="h-10 border-b border-slate-200 bg-blue-50/60" />

          <div className="p-5 -mt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900">
                  {isEditing ? 'Editar categoría' : 'Nueva categoría'}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Define un nombre y (opcional) una categoría padre.
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
              <div>
                <FieldLabel>Nombre</FieldLabel>
                <TextInput
                  value={form.name}
                  onChange={(v) => onChangeForm({ name: v })}
                  placeholder="Ej: Eléctrico, Hidráulico…"
                  disabled={submitting}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Tip: usa nombres cortos y consistentes.
                </p>
              </div>

              <div>
                <FieldLabel>Categoría padre</FieldLabel>
                <Select
                  value={form.parent_id ?? ''}
                  onChange={(v) => onChangeForm({ parent_id: v ? v : null })}
                  disabled={submitting}
                >
                  <option value="">— Sin padre —</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
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
