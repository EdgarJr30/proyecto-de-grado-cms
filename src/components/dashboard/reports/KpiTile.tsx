function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type KpiTone = 'default' | 'good' | 'warn' | 'danger';

interface KpiTileProps {
  label: string;
  value: number | string;
  description?: string;
  unit?: string;
  tone?: KpiTone;
}

function formatValue(value: number | string) {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('es-DO').format(value);
  }
  return value;
}

export default function KpiTile({
  label,
  value,
  description,
  unit,
  tone = 'default',
}: KpiTileProps) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'danger'
          ? 'border-rose-200 bg-rose-50'
          : 'border-gray-200 bg-white';

  return (
    <div className={cx('rounded-2xl border p-4', toneClass)}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 flex items-end gap-1">
        <span className="text-2xl font-bold text-gray-900">
          {formatValue(value)}
        </span>
        {unit ? <span className="text-xs text-gray-500 pb-1">{unit}</span> : null}
      </div>
      {description ? <div className="mt-1 text-xs text-gray-500">{description}</div> : null}
    </div>
  );
}
