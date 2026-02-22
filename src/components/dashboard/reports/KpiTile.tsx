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
      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/15'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/15'
        : tone === 'danger'
          ? 'border-rose-200 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/15'
          : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900';

  return (
    <div className={cx('rounded-2xl border p-4', toneClass)}>
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 flex items-end gap-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          {formatValue(value)}
        </span>
        {unit ? (
          <span className="text-xs text-gray-500 dark:text-slate-400 pb-1">
            {unit}
          </span>
        ) : null}
      </div>
      {description ? (
        <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          {description}
        </div>
      ) : null}
    </div>
  );
}
