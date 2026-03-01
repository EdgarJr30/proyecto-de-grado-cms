import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { VendorInsert } from '../../../../types/inventory';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function VendorModal({
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
  form: VendorInsert;
  submitting: boolean;
  canManage: boolean;
  onClose: () => void;
  onChangeForm: (patch: Partial<VendorInsert>) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18 }}
        >
          <motion.div
            className="fixed inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={
                prefersReducedMotion
                  ? { opacity: 1, y: 0, scale: 1 }
                  : { opacity: 0, y: 10, scale: 0.985 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 1, y: 0, scale: 1 }
                  : { opacity: 0, y: 6, scale: 0.99 }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
              }
              className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="h-10 border-b border-slate-200 bg-blue-50/60" />

              <div className="p-5 -mt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-slate-900">
                      {isEditing ? 'Editar proveedor' : 'Nuevo proveedor'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Define datos de contacto y estado operativo.
                    </div>
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

                <form onSubmit={onSubmit} className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="text-sm">
                      <span className="font-semibold text-slate-700">Nombre</span>
                      <input
                        value={form.name}
                        onChange={(event) =>
                          onChangeForm({ name: event.target.value })
                        }
                        disabled={submitting || !canManage}
                        className={cx(
                          'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300',
                          (!canManage || submitting) &&
                            'opacity-60 cursor-not-allowed bg-slate-50'
                        )}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="font-semibold text-slate-700">Email</span>
                      <input
                        value={form.email ?? ''}
                        onChange={(event) =>
                          onChangeForm({ email: event.target.value })
                        }
                        disabled={submitting || !canManage}
                        className={cx(
                          'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300',
                          (!canManage || submitting) &&
                            'opacity-60 cursor-not-allowed bg-slate-50'
                        )}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="font-semibold text-slate-700">Teléfono</span>
                      <input
                        value={form.phone ?? ''}
                        onChange={(event) =>
                          onChangeForm({ phone: event.target.value })
                        }
                        disabled={submitting || !canManage}
                        className={cx(
                          'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300',
                          (!canManage || submitting) &&
                            'opacity-60 cursor-not-allowed bg-slate-50'
                        )}
                      />
                    </label>

                    <label className="inline-flex items-center gap-2 mt-7 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={form.is_active ?? true}
                        onChange={(event) =>
                          onChangeForm({ is_active: event.target.checked })
                        }
                        disabled={submitting || !canManage}
                      />
                      Activo
                    </label>
                  </div>

                  {!canManage ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
                      No tienes permiso para gestionar maestros (solo lectura).
                    </div>
                  ) : null}

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={submitting}
                      className="inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !canManage}
                      className={cx(
                        'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                        submitting || !canManage
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      )}
                    >
                      {submitting
                        ? 'Guardando...'
                        : isEditing
                          ? 'Guardar cambios'
                          : 'Crear proveedor'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
