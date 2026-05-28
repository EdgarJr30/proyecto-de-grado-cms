import { BadgeCheck } from 'lucide-react';
import Sidebar from '../../components/layout/Sidebar';
import ApprovalProcessesPanel from '../../components/dashboard/admin/approvals/ApprovalProcessesPanel';

export default function ApprovalProcessesPage() {
  return (
    <div className="h-screen flex bg-[#f4f6fb] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />

      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 min-w-0">
        <header className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-0">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <BadgeCheck className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Procesos de aprobación
                </h1>
                <p className="mt-1 text-sm text-slate-600 max-w-3xl dark:text-slate-300">
                  Crea procesos de validación y asigna aprobadores y solicitantes.
                  Los técnicos solicitantes deberán enviar su trabajo a validación
                  (con evidencia) antes de finalizar un ticket.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 pt-4 pb-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <ApprovalProcessesPanel />
          </div>
        </section>
      </main>
    </div>
  );
}
