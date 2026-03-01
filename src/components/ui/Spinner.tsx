import type { JSX } from 'react';
import { MotionSpin } from './motionPrimitives';

export default function Spinner(): JSX.Element {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <MotionSpin
        className="inline-block h-8 w-8 rounded-full border-4 border-indigo-500 border-t-transparent"
      />
    </div>
  );
}
