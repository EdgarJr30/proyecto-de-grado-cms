import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../../../context/SettingsContext';
import { showToastSuccess, showToastError } from '../../../notifications/toast';

export default function GeneralSettings() {
  const { maxSecondary, update, canManage } = useSettings();
  const [value, setValue] = useState<number>(maxSecondary);
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(maxSecondary), [maxSecondary]);

  const disabled = useMemo(() => saving || !canManage, [saving, canManage]);

  const onSave = async () => {
    try {
      setSaving(true);
      await update(value);
      showToastSuccess('Parámetro actualizado.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToastError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="p-4 md:p-6 rounded-lg border bg-white shadow-sm">
        No tienes permiso para gestionar configuración general.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 rounded-2xl border bg-white shadow-sm space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Órdenes de Trabajo</h2>
        <p className="text-sm text-gray-500">
          Ajusta reglas operativas de asignación y límites.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="block text-sm font-medium">
          Máximo de técnicos secundarios por OT
        </label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            disabled={disabled}
            className="border rounded-lg px-3 py-2 w-40 disabled:bg-gray-100"
          />
          <span className="text-sm text-gray-500">
            Total permitido por OT = 1 principal + este valor.
          </span>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => setValue(maxSecondary)}
          disabled={disabled}
          className={
            'px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 cursor-pointer ' +
            (disabled ? 'opacity-60 cursor-not-allowed' : '')
          }
        >
          Restablecer
        </button>
        <button
          onClick={onSave}
          disabled={disabled}
          className={
            'bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 cursor-pointer ' +
            (disabled ? 'opacity-60 cursor-not-allowed' : '')
          }
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
