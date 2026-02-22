import type { ReactNode } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

interface ReportCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export default function ReportCard({
  title,
  subtitle,
  action,
  children,
  className,
  compact = false,
}: ReportCardProps) {
  return (
    <article
      className={cx(
        'rounded-2xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900',
        compact ? 'p-4' : 'p-5',
        className
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-slate-100 truncate">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-xs md:text-sm text-gray-500 dark:text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <div>{children}</div>
    </article>
  );
}
