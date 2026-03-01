import { motion, useReducedMotion } from 'framer-motion';
import type { ReportBucket } from '../../../types/Report';
import CountUpText from '../../ui/CountUpText';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

interface HorizontalBarListProps {
  items: ReportBucket[];
  maxItems?: number;
  emptyText?: string;
  valueFormatter?: (value: number) => string;
  colorClass?: string;
}

export default function HorizontalBarList({
  items,
  maxItems = 8,
  emptyText = 'Sin datos para el filtro seleccionado.',
  valueFormatter = (value) => new Intl.NumberFormat('es-DO').format(value),
  colorClass = 'bg-blue-600',
}: HorizontalBarListProps) {
  const prefersReducedMotion = useReducedMotion();
  const rows = items.slice(0, maxItems);
  const maxValue = rows.reduce((top, row) => Math.max(top, row.value), 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-gray-50 px-3 py-4 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const width = maxValue > 0 ? Math.max((row.value / maxValue) * 100, 4) : 0;
        const formattedValue = valueFormatter(row.value);

        return (
          <motion.div
            key={row.label}
            className="space-y-1.5"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              prefersReducedMotion
                ? undefined
                : {
                    duration: 0.35,
                    delay: index * 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  }
            }
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium text-gray-700 dark:text-slate-200">
                {row.label}
              </span>
              <span className="shrink-0 text-xs font-semibold text-gray-600 dark:text-slate-300">
                <CountUpText
                  value={formattedValue}
                  duration={0.85}
                  delay={index * 0.06 + 0.08}
                />
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700">
              <motion.div
                className={cx('h-2 rounded-full transition-all', colorClass)}
                initial={prefersReducedMotion ? false : { width: 0 }}
                animate={{ width: `${width}%` }}
                transition={
                  prefersReducedMotion
                    ? undefined
                    : {
                        duration: 0.8,
                        delay: index * 0.06,
                        ease: [0.22, 1, 0.36, 1],
                      }
                }
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
