import { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { AssetChecklistItem, BigIntLike } from '../../../../types/Asset';
import {
  createAssetChecklistItem,
  deleteAssetChecklistItem,
  listAssetChecklistItems,
  updateAssetChecklistItem,
} from '../../../../services/assetsService';
import { showToastError } from '../../../../notifications';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Props = {
  assetId: BigIntLike;
  disabled?: boolean;
};

export default function AssetChecklistManager({
  assetId,
  disabled = false,
}: Props) {
  const [items, setItems] = useState<AssetChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await listAssetChecklistItems(assetId);
        if (alive) setItems(data);
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : 'Error cargando el checklist.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [assetId]);

  const refresh = async () => {
    try {
      setItems(await listAssetChecklistItems(assetId));
    } catch {
      // El toast del flujo ya informó.
    }
  };

  const handleAdd = async () => {
    if (disabled || busy) return;
    const label = newLabel.trim();
    if (!label) {
      showToastError('Escribe la pregunta del checklist.');
      return;
    }
    setBusy(true);
    try {
      await createAssetChecklistItem({
        asset_id: assetId,
        label,
        position: items.length,
      });
      setNewLabel('');
      await refresh();
    } catch (err) {
      showToastError(err instanceof Error ? err.message : 'No se pudo agregar la pregunta.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (item: AssetChecklistItem) => {
    if (disabled || busy) return;
    const label = editingLabel.trim();
    if (!label) {
      showToastError('La pregunta no puede quedar vacía.');
      return;
    }
    setBusy(true);
    try {
      await updateAssetChecklistItem(item.id, { label });
      setEditingId(null);
      setEditingLabel('');
      await refresh();
    } catch (err) {
      showToastError(err instanceof Error ? err.message : 'No se pudo actualizar la pregunta.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item: AssetChecklistItem) => {
    if (disabled || busy) return;
    if (!window.confirm(`¿Eliminar la pregunta "${item.label}"?`)) return;
    setBusy(true);
    try {
      await deleteAssetChecklistItem(item.id);
      await refresh();
    } catch (err) {
      showToastError(err instanceof Error ? err.message : 'No se pudo eliminar la pregunta.');
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (disabled || busy) return;
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    setBusy(true);
    try {
      await Promise.all([
        updateAssetChecklistItem(a.id, { position: target }),
        updateAssetChecklistItem(b.id, { position: index }),
      ]);
      await refresh();
    } catch (err) {
      showToastError(err instanceof Error ? err.message : 'No se pudo reordenar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="md:col-span-2">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-indigo-600" />
          <div className="text-sm font-semibold text-slate-900">
            Preguntas del checklist de cierre
          </div>
        </div>
        <div className="mt-1 text-xs text-slate-600">
          Verificaciones de marcación rápida que el técnico deberá cumplir al
          finalizar (ej: «¿Revisaste el refrigerante?»). Aplican cuando el activo
          tiene activado «Requerir» arriba.
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando preguntas…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              Aún no hay preguntas. Agrega la primera abajo.
            </div>
          ) : (
            items.map((item, index) => {
              const isEditing = editingId === String(item.id);
              return (
                <div
                  key={String(item.id)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => void handleMove(index, -1)}
                      disabled={disabled || busy || index === 0}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      title="Subir"
                      aria-label="Subir"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMove(index, 1)}
                      disabled={disabled || busy || index === items.length - 1}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      title="Bajar"
                      aria-label="Bajar"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  <span className="text-xs font-semibold text-slate-400">
                    {index + 1}.
                  </span>

                  {isEditing ? (
                    <input
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      autoFocus
                      className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                      {item.label}
                    </span>
                  )}

                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(item)}
                        disabled={busy}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                        title="Guardar"
                        aria-label="Guardar"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditingLabel('');
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                        title="Cancelar"
                        aria-label="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(String(item.id));
                          setEditingLabel(item.label);
                        }}
                        disabled={disabled || busy}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-50"
                        title="Editar"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item)}
                        disabled={disabled || busy}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        title="Eliminar"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex gap-2 border-t border-slate-200 pt-4">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAdd();
              }
            }}
            disabled={disabled || busy}
            placeholder="Nueva pregunta (ej: ¿Revisaste el gas?)"
            className={cx(
              'min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
              (disabled || busy) && 'cursor-not-allowed bg-gray-50 opacity-70'
            )}
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={disabled || busy || !newLabel.trim()}
            className={cx(
              'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500',
              (disabled || busy || !newLabel.trim()) &&
                'cursor-not-allowed opacity-50 hover:bg-indigo-600'
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
