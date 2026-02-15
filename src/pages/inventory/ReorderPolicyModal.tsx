import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UUID, ReorderPolicyRow } from '../../types/inventory';
import type { OptionRow } from '../../services/inventory/lookupsService';
import { X } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export type EditorMode = 'create' | 'edit';

export type PolicyEditorState = {
  mode: EditorMode;
  open: boolean;
  row?: ReorderPolicyRow;

  part_id: UUID | '';
  warehouse_id: UUID | '';
  min_qty: number;
  max_qty: number | null;
  reorder_point: number | null;
  safety_stock: number | null;
  lead_time_days: number | null;
  preferred_vendor_id: UUID | null;
};

function toNumOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v: string): number | null {
  const n = toNumOrNull(v);
  if (n === null) return null;
  return Math.max(0, Math.trunc(n));
}

function fmtNum(v: number | null | undefined) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : '—';
}

function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning';
}) {
  const cls =
    tone === 'info'
      ? 'bg-sky-50 text-sky-700 border-sky-200'
      : tone === 'success'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : tone === 'warning'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
        cls
      )}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  rightHint,
  required,
  children,
}: {
  label: string;
  rightHint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {label}
          {required ? <span className="text-red-600 ml-0.5">*</span> : null}
        </label>
        {rightHint ? (
          <span className="text-xs text-slate-500">{rightHint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export default function ReorderPolicyModal({
  open,
  title,
  subtitle,
  loading,
  canWrite,
  editor,
  setEditor,
  onClose,
  onSave,

  warehouses,
  vendors,
  categories,
  parts,

  partSearch,
  setPartSearch,
  partCategoryId,
  setPartCategoryId,

  partLabelById,
  warehouseLabelById,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  loading: boolean;
  canWrite: boolean;

  editor: PolicyEditorState;
  setEditor: React.Dispatch<React.SetStateAction<PolicyEditorState>>;
  onClose: () => void;
  onSave: () => void;

  warehouses: OptionRow[];
  vendors: OptionRow[];
  categories: OptionRow[];
  parts: OptionRow[];

  partSearch: string;
  setPartSearch: (v: string) => void;
  partCategoryId: UUID | '';
  setPartCategoryId: (v: UUID | '') => void;

  partLabelById?: Map<string, string>;
  warehouseLabelById?: Map<string, string>;
}) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [tab, setTab] = useState<'context' | 'summary'>('context');

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.setTimeout(() => closeBtnRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) setTab('context');
  }, [open]);

  const isCreate = editor.mode === 'create';

  const summary = useMemo(() => {
    return [
      { label: 'Min', val: fmtNum(editor.min_qty), span: 1 },
      { label: 'Max', val: fmtNum(editor.max_qty), span: 1 },
      { label: 'Reorder', val: fmtNum(editor.reorder_point), span: 1 },
      { label: 'Safety', val: fmtNum(editor.safety_stock), span: 1 },
      {
        label: 'Lead time',
        val:
          editor.lead_time_days === null ? '—' : `${editor.lead_time_days} d`,
        span: 2,
      },
    ];
  }, [
    editor.lead_time_days,
    editor.max_qty,
    editor.min_qty,
    editor.reorder_point,
    editor.safety_stock,
  ]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* ✅ Backdrop como tu lightbox: sólido y blur suave */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Center */}
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          className={cx(
            'w-full max-w-6xl',
            'rounded-2xl border border-slate-200 dark:border-slate-700',
            'bg-white dark:bg-slate-900', // ✅ sólido
            'shadow-2xl',
            'overflow-hidden',
            'max-h-[92vh]'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ✅ Header sólido */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {title}
                  </h2>
                  <Pill tone="info">{isCreate ? 'Nuevo' : 'Editando'}</Pill>
                </div>
                {subtitle ? (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {subtitle}
                  </p>
                ) : null}
              </div>

              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                className={cx(
                  'h-11 w-11 rounded-xl border border-slate-300 dark:border-slate-600',
                  'inline-flex items-center justify-center',
                  'hover:bg-slate-100 dark:hover:bg-slate-800',
                  'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                )}
                aria-label="Cerrar"
              >
                <X className="h-5 w-5 text-slate-700 dark:text-slate-200" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 overflow-auto max-h-[calc(92vh-72px-72px)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Context card */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        Contexto
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        Selecciona repuesto y almacén
                      </div>
                    </div>

                    {/* ✅ segment control sólido */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setTab('context')}
                        className={cx(
                          'h-9 px-4 rounded-lg text-sm font-semibold transition',
                          tab === 'context'
                            ? 'bg-white dark:bg-slate-900 shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        )}
                      >
                        Contexto
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab('summary')}
                        className={cx(
                          'h-9 px-4 rounded-lg text-sm font-semibold transition',
                          tab === 'summary'
                            ? 'bg-white dark:bg-slate-900 shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        )}
                      >
                        Resumen
                      </button>
                    </div>
                  </div>

                  {tab === 'context' ? (
                    <div className="mt-5 space-y-4">
                      <Field
                        label="Repuesto (Part)"
                        rightHint={
                          isCreate ? 'Filtra por categoría' : 'Bloqueado'
                        }
                        required
                      >
                        {isCreate ? (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <select
                                className={cx(
                                  'h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm',
                                  'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                                )}
                                value={partCategoryId}
                                onChange={(e) =>
                                  setPartCategoryId(
                                    (e.target.value as UUID) || ''
                                  )
                                }
                              >
                                <option value="">Todas categorías</option>
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>

                              <input
                                className={cx(
                                  'h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm',
                                  'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                                )}
                                placeholder="Buscar (code/name).."
                                value={partSearch}
                                onChange={(e) => setPartSearch(e.target.value)}
                              />
                            </div>

                            <select
                              className={cx(
                                'h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm',
                                'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                              )}
                              value={editor.part_id}
                              onChange={(e) =>
                                setEditor((s) => ({
                                  ...s,
                                  part_id: (e.target.value as UUID) || '',
                                }))
                              }
                            >
                              <option value="">Selecciona un repuesto…</option>
                              {parts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {partLabelById?.get(editor.part_id as UUID) ??
                                '—'}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 font-mono break-all">
                              {editor.part_id}
                            </div>
                          </div>
                        )}
                      </Field>

                      <Field label="Warehouse" required>
                        {isCreate ? (
                          <select
                            className={cx(
                              'h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm',
                              'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                            )}
                            value={editor.warehouse_id}
                            onChange={(e) =>
                              setEditor((s) => ({
                                ...s,
                                warehouse_id: (e.target.value as UUID) || '',
                              }))
                            }
                          >
                            <option value="">Selecciona un warehouse…</option>
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {warehouseLabelById?.get(
                                editor.warehouse_id as UUID
                              ) ?? editor.warehouse_id}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 font-mono break-all">
                              {editor.warehouse_id}
                            </div>
                          </div>
                        )}
                      </Field>

                      <Field label="Vendor preferido" rightHint="Opcional">
                        <select
                          className={cx(
                            'h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                          )}
                          value={editor.preferred_vendor_id ?? ''}
                          onChange={(e) =>
                            setEditor((s) => ({
                              ...s,
                              preferred_vendor_id:
                                (e.target.value as UUID) || null,
                            }))
                          }
                        >
                          <option value="">—</option>
                          {vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Resumen
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {summary.map((s) => (
                            <div
                              key={s.label}
                              className={cx(s.span === 2 && 'col-span-2')}
                            >
                              <div className="text-xs text-slate-500">
                                {s.label}
                              </div>
                              <div className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                {s.val}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-slate-500">
                        Nota: si{' '}
                        <span className="font-mono">reorder_point</span> está
                        null, usa <span className="font-mono">min_qty</span>{' '}
                        como gatillo.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Parameters card */}
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        Parámetros de reposición
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        Define cantidades objetivo y reglas de abastecimiento.
                      </div>
                    </div>
                    <Pill tone="info">Quantities</Pill>
                  </div>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Field label="Min qty" rightHint="Obligatorio" required>
                        <input
                          type="number"
                          step="0.001"
                          className={cx(
                            'h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                          )}
                          value={editor.min_qty}
                          onChange={(e) =>
                            setEditor((s) => ({
                              ...s,
                              min_qty: Number(e.target.value),
                            }))
                          }
                        />
                      </Field>
                      <div className="text-xs text-slate-500">
                        Umbral mínimo (stock target).
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Field label="Max qty" rightHint="Opcional">
                        <input
                          type="number"
                          step="0.001"
                          className={cx(
                            'h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                          )}
                          value={editor.max_qty ?? ''}
                          onChange={(e) =>
                            setEditor((s) => ({
                              ...s,
                              max_qty: toNumOrNull(e.target.value),
                            }))
                          }
                        />
                      </Field>
                      <div className="text-xs text-slate-500">
                        Compra sugerida hasta Max.
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Field label="Reorder point" rightHint="Opcional">
                        <input
                          type="number"
                          step="0.001"
                          className={cx(
                            'h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                          )}
                          value={editor.reorder_point ?? ''}
                          onChange={(e) =>
                            setEditor((s) => ({
                              ...s,
                              reorder_point: toNumOrNull(e.target.value),
                            }))
                          }
                        />
                      </Field>
                      <div className="text-xs text-slate-500">
                        Si está null usa{' '}
                        <span className="font-mono">min_qty</span>.
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Field label="Safety stock" rightHint="Opcional">
                        <input
                          type="number"
                          step="0.001"
                          className={cx(
                            'h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                          )}
                          value={editor.safety_stock ?? ''}
                          onChange={(e) =>
                            setEditor((s) => ({
                              ...s,
                              safety_stock: toNumOrNull(e.target.value),
                            }))
                          }
                        />
                      </Field>
                      <div className="text-xs text-slate-500">
                        Buffer para variabilidad.
                      </div>
                    </div>

                    <div className="space-y-2 sm:col-span-1">
                      <Field label="Lead time (días)" rightHint="Opcional">
                        <input
                          type="number"
                          step="1"
                          className={cx(
                            'h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                          )}
                          value={editor.lead_time_days ?? ''}
                          onChange={(e) =>
                            setEditor((s) => ({
                              ...s,
                              lead_time_days: toIntOrNull(e.target.value),
                            }))
                          }
                        />
                      </Field>
                      <div className="text-xs text-slate-500">
                        Tiempo estimado de reposición.
                      </div>
                    </div>

                    <div className="hidden sm:block" />
                  </div>
                </div>

                {/* Validation card */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Validación rápida
                  </div>
                  <ul className="mt-3 text-sm text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-5">
                    <li>
                      <span className="font-mono">min_qty</span> debe ser ≥ 0.
                    </li>
                    <li>
                      Si defines <span className="font-mono">max_qty</span>,
                      idealmente ≥ <span className="font-mono">min_qty</span>.
                    </li>
                    <li>
                      <span className="font-mono">reorder_point</span> puede ser
                      distinto a Min.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ Footer sólido (como tu work order) */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Configura <span className="font-mono">min_qty</span> primero.
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={cx(
                    'h-11 px-5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-semibold',
                    'bg-slate-100 dark:bg-slate-800',
                    'hover:bg-slate-200 dark:hover:bg-slate-700',
                    'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                  )}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={onSave}
                  disabled={!canWrite || loading}
                  className={cx(
                    'h-11 px-6 rounded-xl text-sm font-semibold',
                    'bg-blue-600 text-white hover:bg-blue-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'focus:outline-none focus:ring-2 focus:ring-blue-400/40'
                  )}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
