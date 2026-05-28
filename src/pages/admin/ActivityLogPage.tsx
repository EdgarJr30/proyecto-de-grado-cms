import { ScrollText } from 'lucide-react';
import Sidebar from '../../components/layout/Sidebar';
import ActivityLogPanel from '../../components/dashboard/admin/activity-log/ActivityLogPanel';

export default function ActivityLogPage() {
  return (
    <div className="h-screen flex bg-[#f4f6fb] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />

      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 min-w-0">
        <header className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-0">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <ScrollText className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Bitácora de actividad
                </h1>
                <p className="mt-1 text-sm text-slate-600 max-w-3xl dark:text-slate-300">
                  Registro de auditoría de las acciones realizadas en la
                  plataforma: tickets, asignaciones, comentarios, usuarios,
                  permisos, inventario, activos y sesiones.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 pt-4 pb-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <ActivityLogPanel />
          </div>
        </section>
      </main>
    </div>
  );
}
