import React from 'react';

interface AppVersionProps {
  version?: string;
  env?: 'PROD' | 'QA' | string;
  className?: string;
}

const AppVersion: React.FC<AppVersionProps> = ({
  version = __APP_VERSION__ || 'unknown',
  env = import.meta.env.VITE_APP_ENV ?? 'PROD',
  className = '',
}) => {
  const normalizedEnv = env.toUpperCase();
  const isQA = normalizedEnv === 'QA';
  const isProd = normalizedEnv === 'PROD';

  return (
    <div
      className={`text-xs text-gray-400 px-3 py-1 border-gray-800 ${className}`}
    >
      <span>
        Versión {version} -{' '}
        {isQA && <span className="text-yellow-400 ml-1">QA</span>}
        {isProd && <span className="text-green-400 ml-1">Prod</span>}
      </span>
    </div>
  );
};

export default AppVersion;
