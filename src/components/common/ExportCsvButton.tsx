import React from 'react';

type Props = {
  onExport: () => Promise<void>;
  className?: string;
  disabled?: boolean;
  label?: string;
};

export default function ExportCsvButton({
  onExport,
  className,
  disabled,
  label = 'Exportar',
}: Props) {
  const [busy, setBusy] = React.useState(false);

  const handleClick = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await onExport();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || disabled}
      className={
        className ??
        ' items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-60 cursor-pointer'
      }
      title={label}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="w-4 h-4 mr-2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>

      {busy ? 'Exportando…' : label}
    </button>
  );
}
