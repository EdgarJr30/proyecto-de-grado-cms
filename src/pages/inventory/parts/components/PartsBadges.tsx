import type { PartCriticality } from '../../../../types/inventory';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

// eslint-disable-next-line react-refresh/only-export-components
export function criticalityConfig(value: PartCriticality) {
  switch (value) {
    case 'LOW':
      return {
        label: 'LOW',
        cls: 'bg-slate-50 text-slate-700 border-slate-200',
      };
    case 'MEDIUM':
      return { label: 'MEDIUM', cls: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'HIGH':
      return {
        label: 'HIGH',
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'CRITICAL':
      return {
        label: 'CRITICAL',
        cls: 'bg-rose-50 text-rose-700 border-rose-200',
      };
  }
}

export function CriticalityBadge({ value }: { value: PartCriticality }) {
  const c = criticalityConfig(value);
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        c.cls
      )}
    >
      {c.label}
    </span>
  );
}

export function Chip({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'success' | 'danger' | 'muted' | 'default';
}) {
  const cls =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'danger'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : tone === 'muted'
          ? 'bg-slate-50 text-slate-600 border-slate-200'
          : 'bg-indigo-50 text-indigo-700 border-indigo-200';

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        cls
      )}
    >
      {children}
    </span>
  );
}
