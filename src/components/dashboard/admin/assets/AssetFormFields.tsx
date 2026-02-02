import type React from 'react';
import type { AssetStatus } from '../../../../types/Asset';

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

// Forma mínima que ambos (insert y update) comparten para pintar campos
export type AssetFormShape = {
  code?: string | null;
  name?: string | null;

  description?: string | null;

  // OJO: si en tu proyecto location_id viene como BigIntLike (string/number/bigint),
  // cambia esto a: string | number | bigint | null | undefined
  location_id?: number | null;

  category?: string | null;
  asset_type?: string | null;

  criticality?: Criticality | null;
  status?: AssetStatus | null;

  is_active?: boolean | null;

  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  asset_tag?: string | null;

  purchase_date?: string | null;
  install_date?: string | null;
  warranty_end_date?: string | null;

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

      <div>
        <label className="text-sm font-medium text-gray-700">Categoría</label>
        <input
          value={form.category ?? ''}
          onChange={(e) => {
            if (isLocked('category')) return;
            setForm(
              (p) =>
                ({
                  ...p,
                  category: e.target.value ? e.target.value : null,
                }) as T
            );
          }}
          disabled={isFieldDisabled('category')}
          className={cx(
            'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200',
            isFieldDisabled('category') &&
              'opacity-70 bg-gray-50 cursor-not-allowed'
          )}
          placeholder="HVAC / Eléctrico / Cocina..."
        />
      </div>

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

      {/* is_active solo en edit (en create lo dejas fijo true sin UI) */}
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

      <div>
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
