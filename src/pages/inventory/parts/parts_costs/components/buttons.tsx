function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  title,
  icon: Icon,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition',
        'bg-blue-600 text-white hover:bg-blue-500',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/30',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-blue-600'
      )}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  onClick,
  disabled,
  title,
  icon: Icon,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition',
        'bg-rose-600 text-white hover:bg-rose-500',
        'focus:outline-none focus:ring-2 focus:ring-rose-500/30',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-rose-600'
      )}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  title,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        'inline-flex items-center rounded-xl border px-3 py-2 text-sm font-semibold transition',
        'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
        disabled && 'opacity-50 cursor-not-allowed hover:bg-white'
      )}
    >
      {children}
    </button>
  );
}
