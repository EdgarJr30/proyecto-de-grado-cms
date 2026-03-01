function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function navButtonClass(disabled: boolean) {
  return cx(
    'rounded-xl border px-3 py-1.5 text-sm',
    disabled
      ? 'cursor-not-allowed border-slate-200 text-slate-400'
      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
  );
}

export function InventoryTopPagination({
  isLoading,
  canPrev,
  canNext,
  onPrev,
  onNext,
  className,
}: {
  isLoading?: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  const prevDisabled = Boolean(isLoading) || !canPrev;
  const nextDisabled = Boolean(isLoading) || !canNext;

  return (
    <div className={cx('flex items-center justify-end gap-2', className)}>
      <button
        type="button"
        onClick={onPrev}
        disabled={prevDisabled}
        className={navButtonClass(prevDisabled)}
      >
        Anterior
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className={navButtonClass(nextDisabled)}
      >
        Siguiente
      </button>
    </div>
  );
}

export function InventoryBottomPagination({
  page,
  totalPages,
  totalCount,
  rangeStart,
  rangeEnd,
  isLoading,
  canPrev,
  canNext,
  onPrev,
  onNext,
  className,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  isLoading?: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  const prevDisabled = Boolean(isLoading) || !canPrev;
  const nextDisabled = Boolean(isLoading) || !canNext;

  return (
    <div
      className={cx(
        'px-5 py-4 border-t border-slate-100 bg-white',
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="text-xs text-slate-600">
        Mostrando{' '}
        <span className="font-medium text-slate-900">{rangeStart}</span>
        {' - '}
        <span className="font-medium text-slate-900">{rangeEnd}</span> de{' '}
        <span className="font-medium text-slate-900">{totalCount}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={navButtonClass(prevDisabled)}
          disabled={prevDisabled}
          onClick={onPrev}
        >
          Anterior
        </button>

        <div className="text-sm text-slate-700">
          Página <span className="font-semibold text-slate-900">{page}</span> /{' '}
          <span className="font-semibold text-slate-900">{totalPages}</span>
        </div>

        <button
          type="button"
          className={navButtonClass(nextDisabled)}
          disabled={nextDisabled}
          onClick={onNext}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
