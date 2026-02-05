import { useEffect, useState } from 'react';
import type React from 'react';
import type { AssetStatus } from '../../../../types/Asset';
import { listActiveAssetCategories } from '../../../../services/assetCategoryService';

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

  // =========================
  // Categories (select)
  // =========================
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);

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

      {/* location_id temporal */}
      {showLocationId ? (
        <div>
          <label className="text-sm font-medium text-gray-700">
            location_id (temporal)
          </label>
          <input
            type="number"
            value={Number(form.location_id) || ''}
            onChange={(e) => {
              if (isLocked('location_id')) return;
              setForm(
                (p) =>
                  ({
                    ...p,
                    location_id: e.target.value ? Number(e.target.value) : null,
                  }) as T
              );
            }}
            disabled={isFieldDisabled('location_id')}
            className={cx(
              'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
              isFieldDisabled('location_id') &&
                'opacity-70 bg-gray-50 cursor-not-allowed'
            )}
            placeholder="Ej: 1"
          />
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
          step="0.01"
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
          step="0.01"
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
    </div>
  );
}
