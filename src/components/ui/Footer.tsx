import AppVersion from './AppVersion';
import { useBranding } from '../../context/BrandingContext';

type FooterProps = {
  variant?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
};

export default function Footer({
  variant = 'light',
  compact = false,
  className = '',
}: FooterProps) {
  const { societyName } = useBranding();
  const year = new Date().getFullYear();

  const isDark = variant === 'dark';

  return (
    <footer
      className={`
        border-t
        ${isDark ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'}
        ${className}
      `}
    >
      <div
        className={`
          ${compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-3 text-xs'}
          flex flex-col ${compact ? 'gap-1' : 'gap-2'}
          ${isDark ? '' : 'md:flex-row md:items-center md:justify-between'}
        `}
      >
        <p
          className={`text-center ${compact ? 'leading-tight text-[10px] whitespace-nowrap' : ''}`}
        >
          © {year} {societyName}. All rights reserved.
        </p>

        <div className="flex justify-center">
          <AppVersion className={compact ? 'text-[11px] px-2 py-0.5' : ''} />
        </div>
      </div>
    </footer>
  );
}
