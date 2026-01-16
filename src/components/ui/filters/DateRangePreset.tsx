import { useRef, useState } from 'react';
import AnchoredPopover from './AnchoredPopover';

type DateRange = { from?: string; to?: string };

type Props = {
  labelText: string;
  value?: DateRange;
  onPick: (next: { from: string; to: string }) => void;
  pillBtnCls: string;
};

export function DateRangePreset({
  labelText,
  value,
  onPick,
  pillBtnCls,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const label =
    value?.from && value?.to ? `${value.from} – ${value.to}` : labelText;

  const handleSelect = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (days - 1));

    const nextRange = {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };

    onPick(nextRange);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={pillBtnCls}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg
          className="mr-2 h-4 w-4 text-gray-600"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M6 2a1 1 0 112 0v1h4V2a1 1 0 112 0v1h1a2 2 0 012 2v2H3V5a2 2 0 012-2h1V2zM3 9h14v6a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        </svg>
        {label}
        <svg
          className="ml-2 h-4 w-4 text-gray-500"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.25 7.5L10 12.25 14.75 7.5H5.25z" />
        </svg>
      </button>

      <AnchoredPopover
        anchorRef={btnRef as unknown as React.RefObject<HTMLElement>}
        open={open}
        onClose={() => setOpen(false)}
      >
        <button
          className="inline-flex items-center rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-800 hover:bg-gray-200 w-full justify-start"
          onClick={() => handleSelect(7)}
        >
          Últimos 7 días
        </button>
        <button
          className="inline-flex items-center rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-800 hover:bg-gray-200 w-full justify-start mt-1"
          onClick={() => handleSelect(30)}
        >
          Últimos 30 días
        </button>
        <button
          className="inline-flex items-center rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-800 hover:bg-gray-200 w-full justify-start mt-1"
          onClick={() => handleSelect(90)}
        >
          Últimos 90 días
        </button>
      </AnchoredPopover>
    </div>
  );
}
