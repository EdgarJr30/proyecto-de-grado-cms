import { MotionPulse, MotionSpin } from './motionPrimitives';

type ScreenLoaderProps = {
  title?: string;
  hint?: string;
  fullScreen?: boolean;
};

export default function ScreenLoader({
  title = 'Cargando modulo',
  hint = 'Preparando datos y componentes...',
  fullScreen = false,
}: ScreenLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullScreen
          ? 'grid h-screen w-full place-items-center px-4'
          : 'grid min-h-[40vh] w-full place-items-center px-4'
      }
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <MotionPulse className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-500" />
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <MotionSpin className="inline-block h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </p>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>

          <div className="space-y-2">
            <MotionPulse className="h-2 w-full rounded-full bg-slate-200/90 dark:bg-slate-700/90" />
            <MotionPulse className="h-2 w-4/5 rounded-full bg-slate-200/90 dark:bg-slate-700/90" />
            <MotionPulse className="h-2 w-3/5 rounded-full bg-slate-200/90 dark:bg-slate-700/90" />
          </div>
        </div>
      </div>
    </div>
  );
}
