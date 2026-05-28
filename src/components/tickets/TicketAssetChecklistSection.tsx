import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import {
  getTicketAssetChecklists,
  saveTicketAssetChecklist,
} from '../../services/assetsService';
import type { TicketAssetChecklistView } from '../../types/Asset';
import { showToastError, showToastSuccess } from '../../notifications';
import AnimatedDialog from '../ui/AnimatedDialog';

type ResponseState = Record<string, { checked: boolean; note: string }>;

type Props = {
  ticketId: number;
  status: string;
  /** 'inline' (default) muestra todo; 'modal' muestra una tarjeta compacta + botón. */
  variant?: 'inline' | 'modal';
  /** Notifica a la página el estado más reciente (para habilitar/bloquear validación). */
  onChange?: (view: TicketAssetChecklistView) => void;
};

function keyOf(assetId: string | number, itemId: string | number) {
  return `${assetId}:${itemId}`;
}

export default function TicketAssetChecklistSection({
  ticketId,
  status,
  variant = 'inline',
  onChange,
}: Props) {
  const [view, setView] = useState<TicketAssetChecklistView | null>(null);
  const [responses, setResponses] = useState<ResponseState>({});
  const [loading, setLoading] = useState(true);
  const [savingAsset, setSavingAsset] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const buildResponses = useCallback((data: TicketAssetChecklistView) => {
    const next: ResponseState = {};
    for (const asset of data.assets) {
      for (const item of asset.items) {
        next[keyOf(asset.asset_id, item.item_id)] = {
          checked: item.checked,
          note: item.note ?? '',
        };
      }
    }
    return next;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTicketAssetChecklists(ticketId);
      setView(data);
      setResponses(buildResponses(data));
      onChange?.(data);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'No se pudo cargar el checklist del activo.'
      );
    } finally {
      setLoading(false);
    }
  }, [ticketId, buildResponses, onChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const editable = useMemo(
    () =>
      Boolean(view?.can_fill) &&
      status !== 'Finalizadas' &&
      status !== 'En Validación',
    [view?.can_fill, status]
  );

  const assetIsComplete = useCallback(
    (assetId: string | number, items: { item_id: string | number }[]) =>
      items.every((it) => responses[keyOf(assetId, it.item_id)]?.checked),
    [responses]
  );

  const setChecked = (assetId: string | number, itemId: string | number, checked: boolean) => {
    setResponses((prev) => ({
      ...prev,
      [keyOf(assetId, itemId)]: {
        checked,
        note: prev[keyOf(assetId, itemId)]?.note ?? '',
      },
    }));
  };

  const setNote = (assetId: string | number, itemId: string | number, note: string) => {
    setResponses((prev) => ({
      ...prev,
      [keyOf(assetId, itemId)]: {
        checked: prev[keyOf(assetId, itemId)]?.checked ?? false,
        note,
      },
    }));
  };

  const handleSave = async (assetId: string | number, items: { item_id: string | number; label: string }[]) => {
    if (!editable) return;

    // Regla: nota obligatoria si la verificación no se cumple.
    for (const it of items) {
      const r = responses[keyOf(assetId, it.item_id)];
      if (r && !r.checked && r.note.trim().length === 0) {
        showToastError(`Justifica con una nota la verificación no cumplida: "${it.label}".`);
        return;
      }
    }

    setSavingAsset(String(assetId));
    try {
      await saveTicketAssetChecklist({
        ticket_id: ticketId,
        asset_id: assetId,
        responses: items.map((it) => ({
          item_id: it.item_id,
          checked: responses[keyOf(assetId, it.item_id)]?.checked ?? false,
          note: responses[keyOf(assetId, it.item_id)]?.note ?? null,
        })),
      });
      showToastSuccess('Checklist guardado.');
      await load();
      if (variant === 'modal') setOpen(false);
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'No se pudo guardar el checklist.');
    } finally {
      setSavingAsset(null);
    }
  };

  if (loading) return null;
  if (!view || view.assets.length === 0) return null;

  const statusPill = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
        view.complete
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-amber-100 text-amber-800'
      }`}
    >
      {view.complete ? 'Completo' : 'Pendiente'}
    </span>
  );

  const body = (
    <div className="space-y-4">
      {!editable && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {view.can_fill
            ? 'El checklist ya no es editable en el estado actual del ticket.'
            : 'Vista de solo lectura del checklist completado por el técnico.'}
        </p>
      )}

      {view.assets.map((asset) => {
        const complete = assetIsComplete(asset.asset_id, asset.items);
        const saving = savingAsset === String(asset.asset_id);

        return (
          <div
            key={String(asset.asset_id)}
            className="rounded-xl border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {asset.code} · {asset.name}
                </div>
              </div>
              {complete ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Completo
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  Pendiente
                </span>
              )}
            </div>

            {asset.items.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-500">
                Este activo no tiene preguntas configuradas.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {asset.items.map((item) => {
                  const r = responses[keyOf(asset.asset_id, item.item_id)] ?? {
                    checked: false,
                    note: '',
                  };
                  return (
                    <li key={String(item.item_id)} className="px-3 py-2.5">
                      <label className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={r.checked}
                          disabled={!editable}
                          onChange={(e) =>
                            setChecked(asset.asset_id, item.item_id, e.target.checked)
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 disabled:opacity-60"
                        />
                        <span className="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-100">
                          {item.label}
                        </span>
                      </label>

                      {/* Nota: obligatoria si no se cumple */}
                      {(!r.checked || r.note.trim().length > 0) && (
                        <div className="mt-1.5 pl-7">
                          {editable ? (
                            <input
                              value={r.note}
                              onChange={(e) =>
                                setNote(asset.asset_id, item.item_id, e.target.value)
                              }
                              placeholder={
                                r.checked
                                  ? 'Nota (opcional)'
                                  : 'Nota obligatoria: ¿por qué no se cumplió?'
                              }
                              className={`w-full rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-200 dark:bg-slate-950 dark:text-slate-100 ${
                                !r.checked && r.note.trim().length === 0
                                  ? 'border-amber-300'
                                  : 'border-slate-200 dark:border-slate-700'
                              }`}
                            />
                          ) : r.note.trim().length > 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-semibold">Nota:</span> {r.note}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {editable && asset.items.length > 0 && (
              <div className="flex justify-end border-t border-slate-200 px-3 py-2 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => void handleSave(asset.asset_id, asset.items)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar checklist
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // --- Variante modal: tarjeta compacta + diálogo ---
  if (variant === 'modal') {
    return (
      <>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <ClipboardCheck className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Checklist de cierre del activo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editable
                    ? 'Marca las verificaciones del equipo antes de finalizar.'
                    : 'Verificaciones registradas por el técnico.'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {statusPill}
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200 dark:hover:bg-indigo-500/25"
              >
                <ClipboardCheck className="h-4 w-4" />
                {editable ? 'Completar checklist' : 'Ver checklist'}
              </button>
            </div>
          </div>
        </section>

        {open && (
          <AnimatedDialog
            open
            onClose={() => setOpen(false)}
            overlayClassName="bg-black/40"
            containerClassName="relative flex h-full w-full items-start justify-center overflow-y-auto p-4 sm:p-6"
            panelClassName="w-full max-w-2xl overflow-hidden rounded-2xl border bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Checklist de cierre del activo
                </div>
                {statusPill}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(90vh-72px)] overflow-y-auto px-4 py-4 sm:px-5">
              {body}
            </div>
          </AnimatedDialog>
        )}
      </>
    );
  }

  // --- Variante inline (por defecto) ---
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Checklist de cierre del activo
          </h3>
        </div>
        {statusPill}
      </div>

      {body}
    </section>
  );
}
