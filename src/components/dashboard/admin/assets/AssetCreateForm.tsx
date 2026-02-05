import { useMemo, useState } from 'react';
import type { AssetInsert } from '../../../../types/Asset';
import { createAsset } from '../../../../services/assetsService';
import AssetFormFields from './AssetFormFields';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Props = {
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

export default function AssetCreateForm({ onClose, onCreated }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');

  const [form, setForm] = useState<
    Omit<AssetInsert, 'location_id'> & { location_id: number | null }
  >({
    code: '',
    name: '',
    description: null,
    location_id: null,
    category: null,
    asset_type: null,
    criticality: 3,
    status: 'OPERATIVO',
    is_active: true,
    manufacturer: null,
    model: null,
    serial_number: null,
    asset_tag: null,
    purchase_date: null,
    install_date: null,
    warranty_end_date: null,
    purchase_cost: null,
    salvage_value: null,
    image_url: null,
  });

  const canSave = useMemo(() => {
    const hasBasics =
      form.code.trim().length > 0 && form.name.trim().length > 0;
    const locOk = Number(form.location_id) > 0;
    return hasBasics && locOk && !isSaving;
  }, [form.code, form.name, form.location_id, isSaving]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const loc = Number(form.location_id);
    if (!loc || loc <= 0) {
      setError('Selecciona/indica una ubicación válida (location_id).');
      return;
    }

    setIsSaving(true);
    try {
      await createAsset({
        ...form,
        location_id: loc,
        code: form.code.trim(),
        name: form.name.trim(),
      });
      await onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Wrapper: permite scroll de pantalla si el modal es alto */}
      <div className="relative flex h-full w-full items-start justify-center overflow-y-auto p-4 sm:p-6">
        {/* Panel */}
        <div className="w-full max-w-3xl overflow-hidden rounded-2xl border bg-white shadow-xl max-h-[90vh]">
          {/* Header sticky */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-gray-900">
                Nuevo Activo
              </div>
              <div className="text-sm text-gray-500">
                Crea un activo y guárdalo en la base de datos.
              </div>
            </div>

            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
            {/* Body con scroll interno */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {error ? (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <AssetFormFields
                mode="create"
                form={form}
                setForm={setForm}
                disabled={isSaving}
                showLocationId
              />
            </div>

            {/* Footer sticky */}
            <div className="sticky bottom-0 z-10 border-t bg-white px-4 py-3 sm:px-6">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
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
                    !canSave &&
                      'opacity-40 cursor-not-allowed hover:bg-indigo-600'
                  )}
                >
                  {isSaving ? 'Guardando…' : 'Crear'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
