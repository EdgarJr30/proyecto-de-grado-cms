import { useEffect, useMemo, useState } from 'react';
import AnimatedDialog from '../../ui/AnimatedDialog';
import { useSettings } from '../../../context/SettingsContext';
import { useCan } from '../../../rbac/PermissionsContext';
import {
  showToastError,
  showToastSuccess,
} from '../../../notifications/toast';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function WorkOrdersSettingsModal({ open, onClose }: Props) {
  const canManage = useCan('work_orders:full_access');
  const { maxSecondary, update } = useSettings();
  const [value, setValue] = useState<string>(String(maxSecondary));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(String(maxSecondary));
  }, [maxSecondary, open]);

  const parsedValue = Number(value);
  const isValid =
    value.trim() !== '' &&
    Number.isInteger(parsedValue) &&
    parsedValue >= 0;
  const totalAllowed = isValid ? parsedValue + 1 : maxSecondary + 1;

  const disabled = useMemo(
    () => saving || !canManage || !isValid,
    [canManage, isValid, saving]
  );

  if (!canManage) return null;

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;

    try {
      setSaving(true);
      await update(parsedValue);
      showToastSuccess('Configuración de órdenes de trabajo actualizada.');
      onClose();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'No se pudo guardar.';
      showToastError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatedDialog
      open={open}
      onClose={saving ? undefined : onClose}
      closeOnEsc={!saving}
      closeOnOverlay={!saving}
      overlayClassName="bg-slate-950/40 backdrop-blur-[2px]"
      panelClassName="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
              Ordenes de trabajo
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">
              Limite de tecnicos por OT
            </h2>
            <p className="text-sm text-slate-500">
              Define cuantos tecnicos secundarios se pueden asignar ademas del
              tecnico principal.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Cerrar configuracion"
            title="Cerrar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSave}>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
            <label
              htmlFor="max-secondary-assignees"
              className="block text-sm font-medium text-slate-800"
            >
              Maximo de tecnicos secundarios por orden
            </label>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                id="max-secondary-assignees"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={saving}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100 sm:w-40"
              />

              <div className="space-y-1 text-sm text-slate-500">
                <p>Total permitido por OT = 1 principal + este valor.</p>
                <p className="font-medium text-slate-700">
                  Capacidad total actual: {totalAllowed} tecnico
                  {totalAllowed === 1 ? '' : 's'}.
                </p>
              </div>
            </div>

            {!isValid && (
              <p className="mt-3 text-sm text-rose-600">
                Ingresa un numero entero mayor o igual a 0.
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setValue(String(maxSecondary))}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Restablecer
            </button>
            <button
              type="submit"
              disabled={disabled}
              className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar configuracion'}
            </button>
          </div>
        </form>
      </div>
    </AnimatedDialog>
  );
}
