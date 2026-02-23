import type {
  PartCriticality,
  PartCategoryRow,
  UomRow,
} from '../../../../types/inventory';
import {
  Boxes,
  CheckCircle2,
  Layers,
  PackageSearch,
  Pencil,
  Plus,
  Ruler,
  ShieldAlert,
  Tag,
  X,
  XCircle,
} from 'lucide-react';
import { Chip, CriticalityBadge } from './PartsBadges';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function SeparatorLite(props: {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  const o = props.orientation ?? 'horizontal';
  return (
    <div
      className={cx(
        o === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
        'bg-slate-200',
        props.className
      )}
    />
  );
}

function Modal(props: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { open, title, subtitle, onClose, children } = props;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {title}
              </div>
              {subtitle ? (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {subtitle}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X className="h-4 w-4 text-slate-600" />
            </button>
          </div>

          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export type PartsFormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  uom_id: string;
  category_id: string | null;
  criticality: PartCriticality;
  is_active: boolean;
  is_stocked: boolean;
};

export default function PartsForm(props: {
  open: boolean;
  isEditing: boolean;
  canManage: boolean;
  submitting: boolean;
  form: PartsFormState;
  setForm: React.Dispatch<React.SetStateAction<PartsFormState>>;
  uoms: UomRow[];
  categories: PartCategoryRow[];
  normalizeCode: (raw: string) => string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
}) {
  const {
    open,
    isEditing,
    canManage,
    submitting,
    form,
    setForm,
    uoms,
    categories,
    normalizeCode,
    onClose,
    onSubmit,
  } = props;

  return (
    <Modal
      open={open}
      title={isEditing ? 'Editar repuesto' : 'Nuevo repuesto'}
      subtitle="Código, UdM y banderas operativas. Mantén el catálogo limpio y consistente."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Chip tone={form.is_active ? 'success' : 'danger'}>
            {form.is_active ? 'Activo' : 'Inactivo'}
          </Chip>
          <Chip tone={form.is_stocked ? 'default' : 'muted'}>
            {form.is_stocked ? 'En inventario' : 'Sin inventario'}
          </Chip>
          <CriticalityBadge value={form.criticality} />
          <Chip tone="muted">
            Código:{' '}
            <span className="font-mono ml-1">
              {normalizeCode(form.code || '—')}
            </span>
          </Chip>
        </div>

        <SeparatorLite />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                <PackageSearch className="h-4 w-4 text-blue-700" />
              </span>
              Código
            </label>
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              onBlur={() =>
                setForm((f) => ({ ...f, code: normalizeCode(f.code) }))
              }
              placeholder="BRG-001"
              required
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Se normaliza a <span className="font-mono">MAYÚSCULAS</span>.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                <Boxes className="h-4 w-4 text-blue-700" />
              </span>
              Nombre
            </label>
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Rodamiento 6203…"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                <Tag className="h-4 w-4 text-blue-700" />
              </span>
              Descripción
            </label>
            <textarea
              className="mt-1 min-h-[96px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Notas, especificaciones, equivalencias…"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                <Ruler className="h-4 w-4 text-blue-700" />
              </span>
              UdM
            </label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.uom_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, uom_id: e.target.value }))
              }
              required
            >
              <option value="">Selecciona…</option>
              {uoms.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                <Tag className="h-4 w-4 text-blue-700" />
              </span>
              Categoría
            </label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.category_id ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category_id: e.target.value ? e.target.value : null,
                }))
              }
            >
              <option value="">— Sin categoría —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                <ShieldAlert className="h-4 w-4 text-blue-700" />
              </span>
              Criticidad
            </label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.criticality}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  criticality: e.target.value as PartCriticality,
                }))
              }
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    Activo
                  </div>
                  <div className="text-xs text-slate-500">
                    Controla visibilidad/uso en operaciones.
                  </div>
                </div>

                <label className="inline-flex items-center gap-2">
                  <input
                    id="is_active"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_active: e.target.checked }))
                    }
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {form.is_active ? 'Sí' : 'No'}
                  </span>
                </label>
              </div>

              <div className="mt-3">
                <Chip tone={form.is_active ? 'success' : 'danger'}>
                  {form.is_active ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Activo
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Inactivo
                    </>
                  )}
                </Chip>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    Inventariable
                  </div>
                  <div className="text-xs text-slate-500">
                    Marca si este repuesto se maneja por stock.
                  </div>
                </div>

                <label className="inline-flex items-center gap-2">
                  <input
                    id="is_stocked"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    checked={form.is_stocked}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_stocked: e.target.checked }))
                    }
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {form.is_stocked ? 'Sí' : 'No'}
                  </span>
                </label>
              </div>

              <div className="mt-3">
                <Chip tone={form.is_stocked ? 'default' : 'muted'}>
                  <Layers className="h-3.5 w-3.5 mr-1" />
                  {form.is_stocked ? 'En inventario' : 'Sin inventario'}
                </Chip>
              </div>
            </div>
          </div>
        </div>

        <SeparatorLite />

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={submitting}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className={cx(
              'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
              !canManage || submitting
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            )}
            disabled={submitting || !canManage}
            title={
              !canManage
                ? 'No tienes permiso para gestionar maestros'
                : undefined
            }
          >
            {submitting ? (
              'Guardando…'
            ) : isEditing ? (
              <>
                <Pencil className="h-4 w-4 mr-2" />
                Guardar cambios
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Crear
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
