import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import type {
  AssetPreventiveFrequencyUnit,
  AssetStatus,
} from '../../../../types/Asset';
import { listActiveAssetCategories } from '../../../../services/assetCategoryService';
import { listLocationOptions } from '../../../../services/locationService';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export const STATUS_OPTIONS: Array<{ value: AssetStatus; label: string }> = [
  { value: 'OPERATIVO', label: 'Operativo' },
  { value: 'EN_MANTENIMIENTO', label: 'En mantenimiento' },
  { value: 'FUERA_DE_SERVICIO', label: 'Fuera de servicio' },
  { value: 'RETIRADO', label: 'Retirado' },
];

type Criticality = 1 | 2 | 3 | 4 | 5;
type CategoryOption = { id: number; name: string; is_active: boolean };
type LocationOption = { id: number; name: string; code: string };
type PriorityValue = 'Baja' | 'Media' | 'Alta';
type PreventivePresetKey =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'YEARLY'
  | 'CUSTOM';

const PREVENTIVE_FREQUENCY_OPTIONS: Array<{
  value: AssetPreventiveFrequencyUnit;
  label: string;
}> = [
  { value: 'DAY', label: 'Días' },
  { value: 'WEEK', label: 'Semanas' },
  { value: 'MONTH', label: 'Meses' },
  { value: 'YEAR', label: 'Años' },
];

const PREVENTIVE_PRIORITY_OPTIONS: Array<{
  value: PriorityValue;
  label: string;
}> = [
  { value: 'Baja', label: 'Baja' },
  { value: 'Media', label: 'Media' },
  { value: 'Alta', label: 'Alta' },
];

const PREVENTIVE_PRESET_OPTIONS: Array<{
  key: PreventivePresetKey;
  label: string;
  value: number;
  unit: AssetPreventiveFrequencyUnit;
}> = [
  { key: 'WEEKLY', label: 'Semanal', value: 1, unit: 'WEEK' },
  { key: 'MONTHLY', label: 'Mensual', value: 1, unit: 'MONTH' },
  { key: 'QUARTERLY', label: 'Trimestral', value: 3, unit: 'MONTH' },
  { key: 'SEMIANNUAL', label: 'Semestral', value: 6, unit: 'MONTH' },
  { key: 'YEARLY', label: 'Anual', value: 1, unit: 'YEAR' },
  { key: 'CUSTOM', label: 'Personalizado', value: 1, unit: 'MONTH' },
];

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalIsoDate(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDateEs(value: string | null | undefined): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return '—';
  return parsed.toLocaleDateString('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function addFrequencyInterval(
  from: Date,
  value: number,
  unit: AssetPreventiveFrequencyUnit
): Date {
  const next = new Date(from.getTime());

  switch (unit) {
    case 'DAY':
      next.setDate(next.getDate() + value);
      break;
    case 'WEEK':
      next.setDate(next.getDate() + value * 7);
      break;
    case 'MONTH':
      next.setMonth(next.getMonth() + value);
      break;
    case 'YEAR':
      next.setFullYear(next.getFullYear() + value);
      break;
    default:
      break;
  }

  return next;
}

function computeNextDuePreview(
  startOn: string | null | undefined,
  value: number,
  unit: AssetPreventiveFrequencyUnit
): string | null {
  const startDate = parseIsoDate(startOn);
  if (!startDate) return null;

  const today = new Date();
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  let next = new Date(startDate.getTime());
  while (next < todayOnly) {
    next = addFrequencyInterval(next, value, unit);
  }

  return toLocalIsoDate(next);
}

function preventiveFrequencyText(
  value: number,
  unit: AssetPreventiveFrequencyUnit
): string {
  const labels: Record<AssetPreventiveFrequencyUnit, [string, string]> = {
    DAY: ['día', 'días'],
    WEEK: ['semana', 'semanas'],
    MONTH: ['mes', 'meses'],
    YEAR: ['año', 'años'],
  };

  const [singular, plural] = labels[unit];
  return `cada ${value} ${value === 1 ? singular : plural}`;
}

function resolvePreset(
  value: number,
  unit: AssetPreventiveFrequencyUnit
): PreventivePresetKey {
  if (value === 1 && unit === 'WEEK') return 'WEEKLY';
  if (value === 1 && unit === 'MONTH') return 'MONTHLY';
  if (value === 3 && unit === 'MONTH') return 'QUARTERLY';
  if (value === 6 && unit === 'MONTH') return 'SEMIANNUAL';
  if (value === 1 && unit === 'YEAR') return 'YEARLY';
  return 'CUSTOM';
}

// Forma mínima que ambos (insert y update) comparten para pintar campos
export type AssetFormShape = {
  code?: string | null;
  name?: string | null;
  description?: string | null;
  location_id?: number | null;
  category_id?: number | null;
  asset_type?: string | null;
  criticality?: Criticality | null;
  status?: AssetStatus | null;
  is_active?: boolean | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  asset_tag?: string | null;
  purchase_date?: string | null; // YYYY-MM-DD
  install_date?: string | null; // YYYY-MM-DD
  warranty_end_date?: string | null; // YYYY-MM-DD
  purchase_cost?: number | null;
  salvage_value?: number | null;
  image_url?: string | null;

  preventive_enabled?: boolean | null;
  preventive_frequency_value?: number | null;
  preventive_frequency_unit?: AssetPreventiveFrequencyUnit | null;
  preventive_start_on?: string | null;
  preventive_lead_days?: number | null;
  preventive_priority?: PriorityValue | null;
  preventive_title_template?: string | null;
  preventive_instructions?: string | null;
  preventive_allow_open_work_orders?: boolean | null;
};

type LockedFields = Partial<Record<keyof AssetFormShape, boolean>>;

type Props<T extends AssetFormShape> = {
  mode: 'create' | 'edit';
  form: T;
  setForm: React.Dispatch<React.SetStateAction<T>>;

  /** Si quieres mostrar el ID solo en edit y readonly, pásalo */
  assetId?: number;

  /** Opcional: deshabilitar campos cuando está guardando */
  disabled?: boolean;

  /** Si quieres ocultar location temporal cuando ya tengas selector */
  showLocationId?: boolean;

  /** Campos bloqueados para edición (ej: { code: true }) */
  lockedFields?: LockedFields;
};

export default function AssetFormFields<T extends AssetFormShape>({
  mode,
  form,
  setForm,
  assetId,
  disabled = false,
  showLocationId = true,
  lockedFields,
}: Props<T>) {
  const isLocked = (key: keyof AssetFormShape) => Boolean(lockedFields?.[key]);

  const isFieldDisabled = (key: keyof AssetFormShape) =>
    disabled || isLocked(key);

  const numToInput = (v: number | null | undefined) =>
    typeof v === 'number' && Number.isFinite(v) ? String(v) : '';

  const dateToInput = (v: string | null | undefined) => (v ? String(v) : '');
  const todayIso = toLocalIsoDate(new Date());
  const tomorrowIso = (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toLocalIsoDate(tomorrow);
  })();

  const preventiveEnabled = !!form.preventive_enabled;
  const preventiveValue = Math.max(1, Number(form.preventive_frequency_value ?? 1));
  const preventiveUnit = (form.preventive_frequency_unit ??
    'MONTH') as AssetPreventiveFrequencyUnit;
  const derivedPreventivePreset = useMemo(
    () => resolvePreset(preventiveValue, preventiveUnit),
    [preventiveUnit, preventiveValue]
  );
  const [forceCustomPreset, setForceCustomPreset] = useState(false);
  const preventivePreset: PreventivePresetKey = forceCustomPreset
    ? 'CUSTOM'
    : derivedPreventivePreset;
  const nextDuePreview = useMemo(
    () =>
      computeNextDuePreview(
        form.preventive_start_on ?? null,
        preventiveValue,
        preventiveUnit
      ),
    [form.preventive_start_on, preventiveUnit, preventiveValue]
  );

  const [showPreventiveAdvanced, setShowPreventiveAdvanced] = useState(false);

  useEffect(() => {
    if (!preventiveEnabled) {
      setForceCustomPreset(false);
    }
  }, [preventiveEnabled]);

  useEffect(() => {
    const hasAdvancedData =
      (form.preventive_priority ?? 'Media') !== 'Media' ||
      (form.preventive_title_template ?? '').trim().length > 0 ||
      (form.preventive_instructions ?? '').trim().length > 0 ||
      !!form.preventive_allow_open_work_orders;

    if (hasAdvancedData) {
      setShowPreventiveAdvanced(true);
    }
  }, [
    form.preventive_allow_open_work_orders,
    form.preventive_instructions,
    form.preventive_priority,
    form.preventive_title_template,
  ]);

  const applyPreventivePreset = (preset: PreventivePresetKey) => {
    if (preset === 'CUSTOM') {
      setForceCustomPreset(true);
      return;
    }

    setForceCustomPreset(false);
    const option = PREVENTIVE_PRESET_OPTIONS.find((item) => item.key === preset);
    if (!option) return;

    setForm(
      (prev) =>
        ({
          ...prev,
          preventive_frequency_value: option.value,
          preventive_frequency_unit: option.unit,
        }) as T
    );
  };

  // =========================
  // Categories (select)
  // =========================
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLocationsLoading(true);
        setLocationsError(null);
        const data = await listLocationOptions();
        if (!alive) return;
        setLocations(data);
      } catch (error) {
        if (!alive) return;
        setLocationsError(
          error instanceof Error ? error.message : 'Error cargando ubicaciones'
        );
      } finally {
        if (alive) setLocationsLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setCatsLoading(true);
        const data = await listActiveAssetCategories();
        if (!alive) return;
        setCategories(data);
      } finally {
        if (alive) setCatsLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* ID readonly (opcional) */}
      {mode === 'edit' && typeof assetId === 'number' ? (
        <div>
          <label className="text-sm font-medium text-gray-700">ID</label>
          <input
            value={assetId}
            disabled
            className={cx(
              'mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 outline-none'
            )}
          />
        </div>
      ) : null}

      {/* code */}
      <div>
        <label className="text-sm font-medium text-gray-700">Código</label>
        <input
          value={String(form.code ?? '')}
          onChange={(e) => {
            if (isLocked('code')) return;
            setForm((p) => ({ ...p, code: e.target.value }) as T);
          }}
          disabled={isFieldDisabled('code')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('code') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="AC-001"
        />
        {mode === 'edit' && isLocked('code') ? (
          <div className="mt-1 text-xs text-gray-500">
            El código no se puede modificar.
          </div>
        ) : null}
      </div>

      {/* name */}
      <div>
        <label className="text-sm font-medium text-gray-700">Nombre</label>
        <input
          value={String(form.name ?? '')}
          onChange={(e) => {
            if (isLocked('name')) return;
            setForm((p) => ({ ...p, name: e.target.value }) as T);
          }}
          disabled={isFieldDisabled('name')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('name') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="Aire Acondicionado Split 24k"
        />
      </div>

      {/* location_id */}
      {showLocationId ? (
        <div>
          <label className="text-sm font-medium text-gray-700">Ubicación</label>
          <select
            value={Number(form.location_id ?? 0)}
            onChange={(e) => {
              if (isLocked('location_id')) return;
              const nextId = Number(e.target.value);
              setForm(
                (p) =>
                  ({
                    ...p,
                    location_id: nextId > 0 ? nextId : null,
                  }) as T
              );
            }}
            disabled={isFieldDisabled('location_id') || locationsLoading}
            className={cx(
              'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
              (isFieldDisabled('location_id') || locationsLoading) &&
                'opacity-70 bg-gray-50 cursor-not-allowed'
            )}
          >
            <option value={0}>
              {locationsLoading ? 'Cargando ubicaciones…' : 'Selecciona una ubicación'}
            </option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
            {Number(form.location_id ?? 0) > 0 &&
            !locations.some((location) => location.id === Number(form.location_id)) ? (
              <option value={Number(form.location_id)}>
                Ubicación actual (ID {Number(form.location_id)})
              </option>
            ) : null}
          </select>

          {locationsError ? (
            <div className="mt-1 text-xs text-rose-600">{locationsError}</div>
          ) : null}
          {!locationsError ? (
            <div className="mt-1 text-xs text-gray-500">
              Selecciona la ubicación por nombre.
            </div>
          ) : null}
        </div>
      ) : null}

      {/* status */}
      <div>
        <label className="text-sm font-medium text-gray-700">Estado</label>
        <select
          value={(form.status ?? 'OPERATIVO') as AssetStatus}
          onChange={(e) => {
            if (isLocked('status')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  status: e.target.value as AssetStatus,
                }) as T
            );
          }}
          disabled={isFieldDisabled('status')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('status') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* ✅ category_id (select) */}
      <div>
        <label className="text-sm font-medium text-gray-700">Categoría</label>
        <select
          value={Number(form.category_id ?? 0)}
          onChange={(e) => {
            if (isLocked('category_id')) return;
            const id = Number(e.target.value);
            setForm((p) => ({ ...p, category_id: id > 0 ? id : null }) as T);
          }}
          disabled={isFieldDisabled('category_id') || catsLoading}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            (isFieldDisabled('category_id') || catsLoading) &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
        >
          <option value={0}>
            {catsLoading ? 'Cargando categorías…' : 'Selecciona una categoría'}
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="mt-1 text-xs text-gray-500">
          Gestiona las categorías en Configuración → General.
        </div>
      </div>

      {/* asset_type */}
      <div>
        <label className="text-sm font-medium text-gray-700">
          Tipo de activo
        </label>
        <input
          value={form.asset_type ?? ''}
          onChange={(e) => {
            if (isLocked('asset_type')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  asset_type: e.target.value ? e.target.value : null,
                }) as T
            );
          }}
          disabled={isFieldDisabled('asset_type')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('asset_type') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="Split / Generador / Bomba..."
        />
      </div>

      {/* criticality */}
      <div>
        <label className="text-sm font-medium text-gray-700">
          Criticidad (1-5)
        </label>
        <select
          value={Number(form.criticality ?? 3) as Criticality}
          onChange={(e) => {
            if (isLocked('criticality')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  criticality: Number(e.target.value) as Criticality,
                }) as T
            );
          }}
          disabled={isFieldDisabled('criticality')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('criticality') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
        >
          {[1, 2, 3, 4, 5].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* is_active solo en edit */}
      {mode === 'edit' ? (
        <div>
          <label className="text-sm font-medium text-gray-700">Activo</label>
          <select
            value={form.is_active ? 'true' : 'false'}
            onChange={(e) => {
              if (isLocked('is_active')) return;
              setForm(
                (p) =>
                  ({
                    ...p,
                    is_active: e.target.value === 'true',
                  }) as T
              );
            }}
            disabled={isFieldDisabled('is_active')}
            className={cx(
              'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
              isFieldDisabled('is_active') &&
                'opacity-70 bg-gray-50 cursor-not-allowed'
            )}
          >
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </div>
      ) : null}

      {/* manufacturer */}
      <div>
        <label className="text-sm font-medium text-gray-700">Fabricante</label>
        <input
          value={form.manufacturer ?? ''}
          onChange={(e) => {
            if (isLocked('manufacturer')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  manufacturer: e.target.value ? e.target.value : null,
                }) as T
            );
          }}
          disabled={isFieldDisabled('manufacturer')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('manufacturer') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="LG / Samsung / Trane..."
        />
      </div>

      {/* model */}
      <div>
        <label className="text-sm font-medium text-gray-700">Modelo</label>
        <input
          value={form.model ?? ''}
          onChange={(e) => {
            if (isLocked('model')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  model: e.target.value ? e.target.value : null,
                }) as T
            );
          }}
          disabled={isFieldDisabled('model')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('model') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="ABC-123"
        />
      </div>

      {/* serial_number */}
      <div>
        <label className="text-sm font-medium text-gray-700">
          Número de serie
        </label>
        <input
          value={form.serial_number ?? ''}
          onChange={(e) => {
            if (isLocked('serial_number')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  serial_number: e.target.value ? e.target.value : null,
                }) as T
            );
          }}
          disabled={isFieldDisabled('serial_number')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('serial_number') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="SN-0000001"
        />
      </div>

      {/* asset_tag */}
      <div>
        <label className="text-sm font-medium text-gray-700">Asset tag</label>
        <input
          value={form.asset_tag ?? ''}
          onChange={(e) => {
            if (isLocked('asset_tag')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  asset_tag: e.target.value ? e.target.value : null,
                }) as T
            );
          }}
          disabled={isFieldDisabled('asset_tag')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('asset_tag') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="TAG-001 / INV-0001"
        />
      </div>

      {/* purchase_date */}
      <div>
        <label className="text-sm font-medium text-gray-700">
          Fecha de compra
        </label>
        <input
          type="date"
          value={dateToInput(form.purchase_date)}
          onChange={(e) => {
            if (isLocked('purchase_date')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  purchase_date: e.target.value ? e.target.value : null,
                }) as T
            );
          }}
          disabled={isFieldDisabled('purchase_date')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('purchase_date') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
        />
      </div>

      {/* install_date */}
      <div>
        <label className="text-sm font-medium text-gray-700">
          Fecha de instalación
        </label>
        <input
          type="date"
          value={dateToInput(form.install_date)}
          onChange={(e) => {
            if (isLocked('install_date')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  install_date: e.target.value ? e.target.value : null,
                }) as T
            );
          }}
          disabled={isFieldDisabled('install_date')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('install_date') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
        />
      </div>

      {/* warranty_end_date */}
      <div>
        <label className="text-sm font-medium text-gray-700">
          Fin de garantía
        </label>
        <input
          type="date"
          value={dateToInput(form.warranty_end_date)}
          onChange={(e) => {
            if (isLocked('warranty_end_date')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  warranty_end_date: e.target.value ? e.target.value : null,
                }) as T
            );
          }}
          disabled={isFieldDisabled('warranty_end_date')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('warranty_end_date') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
        />
      </div>

      {/* purchase_cost */}
      <div>
        <label className="text-sm font-medium text-gray-700">
          Costo de compra
        </label>
        <input
          type="number"
          step="any"
          value={numToInput(form.purchase_cost)}
          onChange={(e) => {
            if (isLocked('purchase_cost')) return;
            const v = e.target.value;
            setForm(
              (p) =>
                ({
                  ...p,
                  purchase_cost: v === '' ? null : Number(v),
                }) as T
            );
          }}
          disabled={isFieldDisabled('purchase_cost')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('purchase_cost') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="0.00"
        />
      </div>

      {/* salvage_value */}
      <div>
        <label className="text-sm font-medium text-gray-700">
          Valor de rescate
        </label>
        <input
          type="number"
          step="any"
          value={numToInput(form.salvage_value)}
          onChange={(e) => {
            if (isLocked('salvage_value')) return;
            const v = e.target.value;
            setForm(
              (p) =>
                ({
                  ...p,
                  salvage_value: v === '' ? null : Number(v),
                }) as T
            );
          }}
          disabled={isFieldDisabled('salvage_value')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('salvage_value') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="0.00"
        />
      </div>

      {/* image_url */}
      <div className="md:col-span-2">
        <label className="text-sm font-medium text-gray-700">URL imagen</label>
        <input
          value={form.image_url ?? ''}
          onChange={(e) => {
            if (isLocked('image_url')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  image_url: e.target.value ? e.target.value : null,
                }) as T
            );
          }}
          disabled={isFieldDisabled('image_url')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('image_url') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="https://..."
        />
      </div>

      {/* description */}
      <div className="md:col-span-2">
        <label className="text-sm font-medium text-gray-700">Descripción</label>
        <textarea
          value={form.description ?? ''}
          onChange={(e) => {
            if (isLocked('description')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  description: e.target.value ? e.target.value : null,
                }) as T
            );
          }}
          disabled={isFieldDisabled('description')}
          className={cx(
            'mt-1 min-h-24 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('description') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="Notas del activo..."
        />
      </div>

      {/* Preventivo */}
      <div className="md:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Mantenimiento preventivo
              </div>
              <div className="text-xs text-slate-600">
                Define recurrencia como en Asana: elige un patrón rápido o usa
                uno personalizado.
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.preventive_enabled ?? false}
                onChange={(e) => {
                  if (isLocked('preventive_enabled')) return;
                  setForm(
                    (p) =>
                      ({
                        ...p,
                        preventive_enabled: e.target.checked,
                      }) as T
                  );
                }}
                disabled={isFieldDisabled('preventive_enabled')}
                className={cx(
                  'h-4 w-4 rounded border-slate-300 text-indigo-600',
                  isFieldDisabled('preventive_enabled') &&
                    'opacity-70 cursor-not-allowed'
                )}
              />
              Activar
            </label>
          </div>

          {!preventiveEnabled ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              Activa esta opción para configurar la recurrencia automática de
              mantenimiento preventivo.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Repetir
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PREVENTIVE_PRESET_OPTIONS.map((preset) => {
                    const selected = preventivePreset === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => {
                          if (isLocked('preventive_frequency_value')) return;
                          if (isLocked('preventive_frequency_unit')) return;
                          applyPreventivePreset(preset.key);
                        }}
                        disabled={
                          isFieldDisabled('preventive_frequency_value') ||
                          isFieldDisabled('preventive_frequency_unit')
                        }
                        className={cx(
                          'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                          selected
                            ? 'border-indigo-200 bg-indigo-100 text-indigo-700'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
                          (isFieldDisabled('preventive_frequency_value') ||
                            isFieldDisabled('preventive_frequency_unit')) &&
                            'cursor-not-allowed opacity-60'
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {preventivePreset === 'CUSTOM' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Cada
                    </label>
                    <div className="mt-1 grid grid-cols-[120px_1fr] gap-2">
                      <input
                        type="number"
                        min={1}
                        value={numToInput(form.preventive_frequency_value)}
                        onChange={(e) => {
                          if (isLocked('preventive_frequency_value')) return;
                          const nextValue = e.target.value;
                          setForm(
                            (p) =>
                              ({
                                ...p,
                                preventive_frequency_value:
                                  nextValue === '' ? null : Number(nextValue),
                              }) as T
                          );
                        }}
                        disabled={isFieldDisabled('preventive_frequency_value')}
                        className={cx(
                          'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
                          isFieldDisabled('preventive_frequency_value') &&
                            'opacity-70 bg-gray-50 cursor-not-allowed'
                        )}
                        placeholder="1"
                      />

                      <select
                        value={preventiveUnit}
                        onChange={(e) => {
                          if (isLocked('preventive_frequency_unit')) return;
                          setForm(
                            (p) =>
                              ({
                                ...p,
                                preventive_frequency_unit:
                                  e.target.value as AssetPreventiveFrequencyUnit,
                              }) as T
                          );
                        }}
                        disabled={isFieldDisabled('preventive_frequency_unit')}
                        className={cx(
                          'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
                          isFieldDisabled('preventive_frequency_unit') &&
                            'opacity-70 bg-gray-50 cursor-not-allowed'
                        )}
                      >
                        {PREVENTIVE_FREQUENCY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  Se repetirá{' '}
                  <span className="font-semibold">
                    {preventiveFrequencyText(preventiveValue, preventiveUnit)}
                  </span>
                  .
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Fecha base del plan
                  </label>
                  <input
                    type="date"
                    value={dateToInput(form.preventive_start_on)}
                    onChange={(e) => {
                      if (isLocked('preventive_start_on')) return;
                      setForm(
                        (p) =>
                          ({
                            ...p,
                            preventive_start_on: e.target.value
                              ? e.target.value
                              : null,
                          }) as T
                      );
                    }}
                    disabled={isFieldDisabled('preventive_start_on')}
                    className={cx(
                      'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
                      isFieldDisabled('preventive_start_on') &&
                        'opacity-70 bg-gray-50 cursor-not-allowed'
                    )}
                  />

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm(
                          (p) =>
                            ({
                              ...p,
                              preventive_start_on: todayIso,
                            }) as T
                        )
                      }
                      disabled={isFieldDisabled('preventive_start_on')}
                      className={cx(
                        'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100',
                        isFieldDisabled('preventive_start_on') &&
                          'opacity-60 cursor-not-allowed'
                      )}
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm(
                          (p) =>
                            ({
                              ...p,
                              preventive_start_on: tomorrowIso,
                            }) as T
                        )
                      }
                      disabled={isFieldDisabled('preventive_start_on')}
                      className={cx(
                        'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100',
                        isFieldDisabled('preventive_start_on') &&
                          'opacity-60 cursor-not-allowed'
                      )}
                    >
                      Mañana
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Días de anticipación para generar OT
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={numToInput(form.preventive_lead_days)}
                    onChange={(e) => {
                      if (isLocked('preventive_lead_days')) return;
                      const nextValue = e.target.value;
                      setForm(
                        (p) =>
                          ({
                            ...p,
                            preventive_lead_days:
                              nextValue === '' ? null : Number(nextValue),
                          }) as T
                      );
                    }}
                    disabled={isFieldDisabled('preventive_lead_days')}
                    className={cx(
                      'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
                      isFieldDisabled('preventive_lead_days') &&
                        'opacity-70 bg-gray-50 cursor-not-allowed'
                    )}
                    placeholder="0"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    0 significa que se genera el mismo día del vencimiento.
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <div className="font-semibold text-slate-700">Vista previa</div>
                <div className="mt-1">
                  Se generará una OT preventiva{' '}
                  <span className="font-semibold">
                    {preventiveFrequencyText(preventiveValue, preventiveUnit)}
                  </span>{' '}
                  desde el{' '}
                  <span className="font-semibold">
                    {formatDateEs(form.preventive_start_on)}
                  </span>
                  .
                </div>
                <div className="mt-0.5">
                  Próxima fecha estimada:{' '}
                  <span className="font-semibold">
                    {formatDateEs(nextDuePreview)}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPreventiveAdvanced((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  {showPreventiveAdvanced
                    ? 'Ocultar opciones avanzadas'
                    : 'Mostrar opciones avanzadas'}
                </button>

                {showPreventiveAdvanced ? (
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Prioridad por defecto
                      </label>
                      <select
                        value={
                          (form.preventive_priority ?? 'Media') as PriorityValue
                        }
                        onChange={(e) => {
                          if (isLocked('preventive_priority')) return;
                          setForm(
                            (p) =>
                              ({
                                ...p,
                                preventive_priority: e.target.value as PriorityValue,
                              }) as T
                          );
                        }}
                        disabled={isFieldDisabled('preventive_priority')}
                        className={cx(
                          'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
                          isFieldDisabled('preventive_priority') &&
                            'opacity-70 bg-gray-50 cursor-not-allowed'
                        )}
                      >
                        {PREVENTIVE_PRIORITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700">
                        Título de OT preventiva (opcional)
                      </label>
                      <input
                        value={form.preventive_title_template ?? ''}
                        onChange={(e) => {
                          if (isLocked('preventive_title_template')) return;
                          setForm(
                            (p) =>
                              ({
                                ...p,
                                preventive_title_template: e.target.value
                                  ? e.target.value
                                  : null,
                              }) as T
                          );
                        }}
                        disabled={isFieldDisabled('preventive_title_template')}
                        className={cx(
                          'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
                          isFieldDisabled('preventive_title_template') &&
                            'opacity-70 bg-gray-50 cursor-not-allowed'
                        )}
                        placeholder="Ej: Mantenimiento preventivo semestral AC-001"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700">
                        Instrucciones preventivas (opcional)
                      </label>
                      <textarea
                        value={form.preventive_instructions ?? ''}
                        onChange={(e) => {
                          if (isLocked('preventive_instructions')) return;
                          setForm(
                            (p) =>
                              ({
                                ...p,
                                preventive_instructions: e.target.value
                                  ? e.target.value
                                  : null,
                              }) as T
                          );
                        }}
                        disabled={isFieldDisabled('preventive_instructions')}
                        className={cx(
                          'mt-1 min-h-24 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
                          isFieldDisabled('preventive_instructions') &&
                            'opacity-70 bg-gray-50 cursor-not-allowed'
                        )}
                        placeholder="Checklist breve de mantenimiento preventivo..."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="inline-flex items-start gap-2 text-sm text-slate-700 sm:items-center">
                        <input
                          type="checkbox"
                          checked={form.preventive_allow_open_work_orders ?? false}
                          onChange={(e) => {
                            if (isLocked('preventive_allow_open_work_orders')) {
                              return;
                            }
                            setForm(
                              (p) =>
                                ({
                                  ...p,
                                  preventive_allow_open_work_orders:
                                    e.target.checked,
                                }) as T
                            );
                          }}
                          disabled={isFieldDisabled(
                            'preventive_allow_open_work_orders'
                          )}
                          className={cx(
                            'mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 sm:mt-0',
                            isFieldDisabled(
                              'preventive_allow_open_work_orders'
                            ) && 'opacity-70 cursor-not-allowed'
                          )}
                        />
                        Permitir más de una OT preventiva abierta al mismo
                        tiempo
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
