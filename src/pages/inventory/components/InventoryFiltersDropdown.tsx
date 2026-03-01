import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown, Search, type LucideIcon } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function InventoryFiltersDropdown({
  icon: Icon,
  title,
  description,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  onSearchSubmit,
  panelActions,
  children,
  kpiWidgets,
  footer,
  defaultDesktopOpen = true,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  panelActions?: ReactNode;
  children?: ReactNode;
  kpiWidgets?: ReactNode;
  footer?: ReactNode;
  defaultDesktopOpen?: boolean;
}) {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(defaultDesktopOpen);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');

    const syncWithViewport = (isDesktop: boolean) => {
      setIsOpen(isDesktop ? defaultDesktopOpen : false);
    };

    syncWithViewport(query.matches);

    const handleChange = (event: MediaQueryListEvent) =>
      syncWithViewport(event.matches);

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleChange);
      return () => query.removeEventListener('change', handleChange);
    }

    query.addListener(handleChange);
    return () => query.removeListener(handleChange);
  }, [defaultDesktopOpen]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-controls={panelId}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Ocultar' : 'Mostrar'} ${title}`}
            className={cx(
              'inline-flex h-10 shrink-0 items-center justify-center rounded-xl border transition',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/30',
              'w-10 md:w-auto md:px-3',
              isOpen
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="sr-only">{title}</span>
            <span className="hidden md:inline ml-2 text-sm font-semibold">
              {title}
            </span>
            <ChevronDown
              className={cx(
                'hidden md:inline ml-1 h-4 w-4 transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </button>

          <form
            className="relative flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              onSearchSubmit?.();
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className={cx(
                'h-10 w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900',
                'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                onSearchSubmit ? 'pl-9 pr-10' : 'pl-9 pr-3'
              )}
            />

            {onSearchSubmit ? (
              <button
                type="submit"
                aria-label="Aplicar búsqueda"
                className={cx(
                  'absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-slate-200',
                  'bg-white text-slate-600 transition hover:bg-slate-50',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/20'
                )}
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </form>
        </div>

        {isOpen ? (
          <div id={panelId} className="space-y-4">
            {description ? (
              <div className="text-xs text-slate-500">{description}</div>
            ) : null}

            {panelActions ? (
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {panelActions}
              </div>
            ) : null}

            {children}
            {kpiWidgets}
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
