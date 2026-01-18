import AppVersion from './AppVersion';
import { useBranding } from '../../context/BrandingContext';

type FooterProps = {
  variant?: 'light' | 'dark';
  className?: string;
};

export default function Footer({
  variant = 'light',
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
          px-4 py-3 text-xs
          flex flex-col gap-2
          ${isDark ? '' : 'md:flex-row md:items-center md:justify-between'}
        `}
      >
        <p className="text-center">
          © {year} {societyName}. All rights reserved.
        </p>

        <div className="flex justify-center">
          <AppVersion />
        </div>
      </div>
    </footer>
  );
}
