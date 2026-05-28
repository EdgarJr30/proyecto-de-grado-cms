import { useEffect, useRef, useState } from 'react';
import { Download, Eye, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import type { AssetManual, BigIntLike } from '../../../../types/Asset';
import {
  deleteAssetManual,
  getAssetManualPublicUrl,
  getAssetManualViewUrl,
  listAssetManuals,
  uploadAssetManual,
} from '../../../../services/assetsService';
import { showToastError, showToastSuccess } from '../../../../notifications';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.zip';

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

type Props = {
  assetId: BigIntLike;
  disabled?: boolean;
  /** Se llama tras subir o borrar un manual (para refrescar vistas externas). */
  onChanged?: () => void;
};

export default function AssetManualsManager({
  assetId,
  disabled = false,
  onChanged,
}: Props) {
  const [manuals, setManuals] = useState<AssetManual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await listAssetManuals(assetId);
        if (!alive) return;
        setManuals(data);
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error ? err.message : 'Error cargando manuales.'
        );
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
      const data = await listAssetManuals(assetId);
      setManuals(data);
    } catch {
      // El toast del flujo principal ya informó; mantenemos la lista previa.
    }
  };

  const handlePickFile = (selected: File | null) => {
    if (selected && selected.size > MAX_FILE_BYTES) {
      showToastError('El archivo supera el límite de 25 MB.');
      return;
    }
    setFile(selected);
    if (selected && !title.trim()) {
      const dot = selected.name.lastIndexOf('.');
      setTitle(dot > 0 ? selected.name.slice(0, dot) : selected.name);
    }
  };

  const handleUpload = async () => {
    if (disabled || uploading) return;
    if (!file) {
      showToastError('Selecciona un archivo.');
      return;
    }
    if (!title.trim()) {
      showToastError('Escribe un nombre para el manual.');
      return;
    }

    setUploading(true);
    try {
      await uploadAssetManual({ asset_id: assetId, title: title.trim(), file });
      showToastSuccess('Manual cargado.');
      setTitle('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refresh();
      onChanged?.();
    } catch (err) {
      showToastError(
        err instanceof Error ? err.message : 'No se pudo cargar el manual.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (manual: AssetManual) => {
    const id = String(manual.id);
    if (disabled || deletingId) return;
    const ok = window.confirm(`¿Eliminar el manual "${manual.title}"?`);
    if (!ok) return;

    setDeletingId(id);
    try {
      await deleteAssetManual({ id: manual.id, file_path: manual.file_path });
      showToastSuccess('Manual eliminado.');
      await refresh();
      onChanged?.();
    } catch (err) {
      showToastError(
        err instanceof Error ? err.message : 'No se pudo eliminar el manual.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="md:col-span-2">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Manuales técnicos
            </div>
            <div className="text-xs text-slate-600">
              Carga los manuales del equipo (PDF, Office, imágenes o ZIP). Cada
              cambio se guarda al instante.
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando manuales…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : manuals.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              Este activo aún no tiene manuales cargados.
            </div>
          ) : (
            manuals.map((manual) => {
              const size = formatSize(manual.size_bytes);
              return (
                <div
                  key={String(manual.id)}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <FileText className="h-5 w-5 shrink-0 text-indigo-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {manual.title}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {manual.file_name ?? 'archivo'}
                      {size ? ` · ${size}` : ''}
                    </div>
                  </div>
                  <a
                    href={getAssetManualViewUrl(manual)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                    title="Ver en línea"
                    aria-label={`Ver ${manual.title}`}
                  >
                    <Eye className="h-4 w-4" />
                  </a>
                  <a
                    href={getAssetManualPublicUrl(manual.file_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={manual.file_name ?? undefined}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                    title="Descargar"
                    aria-label={`Descargar ${manual.title}`}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleDelete(manual)}
                    disabled={disabled || deletingId === String(manual.id)}
                    className={cx(
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600',
                      (disabled || deletingId === String(manual.id)) &&
                        'cursor-not-allowed opacity-60'
                    )}
                    title="Eliminar"
                    aria-label={`Eliminar ${manual.title}`}
                  >
                    {deletingId === String(manual.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Cargar nuevo */}
        <div className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-200 pt-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={disabled || uploading}
              placeholder="Nombre del manual (ej: Manual de usuario)"
              className={cx(
                'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
                (disabled || uploading) &&
                  'cursor-not-allowed bg-gray-50 opacity-70'
              )}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              disabled={disabled || uploading}
              onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
              className={cx(
                'w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100',
                (disabled || uploading) && 'cursor-not-allowed opacity-70'
              )}
            />
          </div>

          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={disabled || uploading || !file || !title.trim()}
            className={cx(
              'inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500',
              (disabled || uploading || !file || !title.trim()) &&
                'cursor-not-allowed opacity-50 hover:bg-indigo-600'
            )}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? 'Cargando…' : 'Cargar manual'}
          </button>
        </div>
      </div>
    </div>
  );
}
