import { useMemo, useState } from 'react';
import type { Asset, AssetUpdate } from '../../../../types/Asset';
import { updateAsset } from '../../../../services/assetsService';
import AssetFormFields from './AssetFormFields';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Props = {
  asset: Asset;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
};

export default function AssetEditForm({ asset, onClose, onUpdated }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');

  const [form, setForm] = useState<AssetUpdate>({
    id: asset.id, // se usa para el update, pero NO se edita en UI
    code: asset.code || undefined,
    name: asset.name || undefined,
    description: asset.description || undefined,
    location_id: asset.location_id ? Number(asset.location_id) : undefined,
    category: asset.category || undefined,
    asset_type: asset.asset_type || undefined,
    criticality: asset.criticality || undefined,
    status: asset.status || undefined,
    is_active: asset.is_active,
    manufacturer: asset.manufacturer || undefined,
    model: asset.model || undefined,
    serial_number: asset.serial_number || undefined,
    asset_tag: asset.asset_tag || undefined,
    purchase_date: asset.purchase_date || undefined,
    install_date: asset.install_date || undefined,
    warranty_end_date: asset.warranty_end_date || undefined,
    purchase_cost: asset.purchase_cost || undefined,
    salvage_value: asset.salvage_value || undefined,
    image_url: asset.image_url || undefined,
  });

  const canSave = useMemo(() => {
    const ok = String(form.code ?? '').trim() && String(form.name ?? '').trim();
    return Boolean(ok) && !isSaving;
  }, [form.code, form.name, isSaving]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    setIsSaving(true);
    try {
      await updateAsset({
        ...form,
        code: String(form.code ?? '').trim(),
        name: String(form.name ?? '').trim(),
      });
      await onUpdated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(720px,95vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-base font-semibold text-gray-900">
              Editar Activo
            </div>
            <div className="text-sm text-gray-500">
              {asset.code} — {asset.name}
            </div>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4">
          {error ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <AssetFormFields
            mode="edit"
            form={{
              ...form,
              location_id: form.location_id
                ? Number(form.location_id)
                : undefined,
            }}
            setForm={(update) => {
              const normalized =
                typeof update === 'function'
                  ? update({
                      ...form,
                      location_id: form.location_id
                        ? Number(form.location_id)
                        : undefined,
                    })
                  : update;
              setForm({
                ...normalized,
                location_id: normalized.location_id
                  ? Number(normalized.location_id)
                  : undefined,
              });
            }}
            disabled={isSaving}
            assetId={
              typeof asset.id === 'string' ? Number(asset.id) : Number(asset.id)
            }
            showLocationId
            lockedFields={{ code: true }}
          />

          <div className="mt-5 flex items-center justify-end gap-2 border-t pt-4">
            <button
              type="button"
              className="rounded-md border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className={cx(
                'rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500',
                !canSave && 'opacity-40 cursor-not-allowed hover:bg-indigo-600'
              )}
            >
              {isSaving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
