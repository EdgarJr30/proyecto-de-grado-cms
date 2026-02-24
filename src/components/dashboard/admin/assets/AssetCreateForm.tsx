import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import type { AssetInsert } from '../../../../types/Asset';
import {
  createAsset,
  upsertAssetPreventivePlan,
} from '../../../../services/assetsService';
import { showToastError, showToastSuccess } from '../../../../notifications';
import AssetFormFields from './AssetFormFields';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Props = {
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

// UI state: number para selects
type AssetCreateFormState = Omit<AssetInsert, 'location_id' | 'category_id'> & {
  location_id: number | null;
  category_id: number | null;
  preventive_enabled: boolean;
  preventive_frequency_value: number;
  preventive_frequency_unit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  preventive_start_on: string | null;
  preventive_lead_days: number;
  preventive_priority: 'Baja' | 'Media' | 'Alta';
  preventive_title_template: string | null;
  preventive_instructions: string | null;
  preventive_allow_open_work_orders: boolean;
};

export default function AssetCreateForm({ onClose, onCreated }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const todayIso = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<AssetCreateFormState>({
    code: '',
    name: '',
    description: null,
    location_id: null,
    category_id: null,
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
    preventive_enabled: false,
    preventive_frequency_value: 1,
    preventive_frequency_unit: 'MONTH',
    preventive_start_on: todayIso,
    preventive_lead_days: 0,
    preventive_priority: 'Media',
    preventive_title_template: null,
    preventive_instructions: null,
    preventive_allow_open_work_orders: false,
  });

  const canSave = useMemo(() => {
    const hasBasics =
      form.code.trim().length > 0 && form.name.trim().length > 0;
    const locOk = Number(form.location_id) > 0;
    const preventiveEnabled = Boolean(form.preventive_enabled);
    const preventiveFreqOk = Number(form.preventive_frequency_value ?? 0) > 0;
    const preventiveStartOk =
      !preventiveEnabled || String(form.preventive_start_on ?? '').length > 0;
    const preventiveLeadOk = Number(form.preventive_lead_days ?? 0) >= 0;

    return (
      hasBasics &&
      locOk &&
      (!preventiveEnabled ||
        (preventiveFreqOk && preventiveStartOk && preventiveLeadOk)) &&
      !isSaving
    );
  }, [
    form.code,
    form.name,
    form.location_id,
    form.preventive_enabled,
    form.preventive_frequency_value,
    form.preventive_start_on,
    form.preventive_lead_days,
    isSaving,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const loc = Number(form.location_id);
    if (!loc || loc <= 0) {
      const msg = 'Selecciona una ubicación válida.';
      setError(msg);
      showToastError(msg);
      return;
    }

    if (form.preventive_enabled) {
      const freq = Number(form.preventive_frequency_value ?? 0);
      const lead = Number(form.preventive_lead_days ?? 0);
      const start = String(form.preventive_start_on ?? '').trim();

      if (!Number.isFinite(freq) || freq <= 0) {
        const msg =
          'La frecuencia preventiva debe ser un número mayor que cero.';
        setError(msg);
        showToastError(msg);
        return;
      }

      if (!start) {
        const msg =
          'La fecha base del mantenimiento preventivo es obligatoria.';
        setError(msg);
        showToastError(msg);
        return;
      }

      if (!Number.isFinite(lead) || lead < 0) {
        const msg =
          'Los días de anticipación preventiva deben ser cero o mayores.';
        setError(msg);
        showToastError(msg);
        return;
      }
    }

    setIsSaving(true);
    try {
      const createdAsset = await createAsset({
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description ?? null,
        location_id: loc,
        category_id: form.category_id ?? null,
        asset_type: form.asset_type ?? null,
        criticality: form.criticality ?? 3,
        status: form.status ?? 'OPERATIVO',
        is_active: form.is_active ?? true,
        manufacturer: form.manufacturer ?? null,
        model: form.model ?? null,
        serial_number: form.serial_number ?? null,
        asset_tag: form.asset_tag ?? null,
        purchase_date: form.purchase_date ?? null,
        install_date: form.install_date ?? null,
        warranty_end_date: form.warranty_end_date ?? null,
        purchase_cost: form.purchase_cost ?? null,
        salvage_value: form.salvage_value ?? null,
        image_url: form.image_url ?? null,
      });

      if (form.preventive_enabled) {
        await upsertAssetPreventivePlan({
          asset_id: createdAsset.id,
          is_active: true,
          frequency_value: Number(form.preventive_frequency_value ?? 1),
          frequency_unit: form.preventive_frequency_unit ?? 'MONTH',
          start_on: String(form.preventive_start_on ?? todayIso),
          lead_days: Number(form.preventive_lead_days ?? 0),
          default_priority: form.preventive_priority ?? 'Media',
          title_template: form.preventive_title_template ?? null,
          instructions: form.preventive_instructions ?? null,
          allow_open_work_orders: Boolean(
            form.preventive_allow_open_work_orders
          ),
          auto_assign_assignee_id: null,
        });
      }

      showToastSuccess('Activo creado.');
      await onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      showToastError(msg);
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
        <div className="w-full max-w-3xl overflow-hidden rounded-2xl border bg-white shadow-xl">
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
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              onClick={onClose}
              aria-label="Cerrar"
              title="Cerrar"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Body con scroll interno */}
            <div className="max-h-[calc(90vh-170px)] overflow-y-auto px-4 py-4 sm:px-6">
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
            <div className="border-t bg-white px-4 py-3 sm:px-6">
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
