import { useSettings } from '../context/SettingsContext';
import { showToastError } from '../notifications/toast';

type SecondaryPickerProps = {
  value: number[]; // ids actuales
  onChange: (ids: number[]) => void;
  options: Array<{ id: number; label: string }>;
};

export function SecondaryPicker({
  value,
  onChange,
  options,
}: SecondaryPickerProps) {
  const { maxSecondary } = useSettings();

  const handleAdd = (assigneeId: number) => {
    if (value.includes(assigneeId)) return;
    if (value.length >= maxSecondary) {
      showToastError(`Máximo ${maxSecondary} técnicos secundarios.`);
      return;
    }
    onChange([...value, assigneeId]);
  };

  const handleRemove = (assigneeId: number) => {
    onChange(value.filter((v) => v !== assigneeId));
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Máximo {maxSecondary} secundarios
      </div>

      <select
        className="border rounded p-2 w-full"
        onChange={(e) => {
          const id = Number(e.target.value);
          if (id) handleAdd(id);
        }}
      >
        <option value="">Añadir técnico…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="flex gap-2 flex-wrap">
        {value.map((id) => {
          const opt = options.find((o) => o.id === id);
          return (
            <span
              key={id}
              className="px-2 py-1 rounded-full bg-slate-200 text-slate-800 text-sm inline-flex items-center gap-2"
            >
              {opt?.label ?? `#${id}`}
              <button
                type="button"
                className="hover:text-red-600"
                onClick={() => handleRemove(id)}
                title="Quitar"
              >
                ✕
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
