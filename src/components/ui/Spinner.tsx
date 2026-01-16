import type { JSX } from 'react';

export default function Spinner(): JSX.Element {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );
}
