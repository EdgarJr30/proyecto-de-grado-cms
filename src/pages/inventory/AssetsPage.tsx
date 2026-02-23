import { Link } from 'react-router-dom';
import { ChevronRight, Wrench } from 'lucide-react';
import Sidebar from '../../components/layout/Sidebar';
import AssetsBoard from '../../components/dashboard/admin/assets/AssetsBoard';
import { usePermissions } from '../../rbac/PermissionsContext';

function EmptyState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
      <div className="font-semibold text-slate-900">Acceso restringido</div>
      <div className="mt-1">
        No tienes permisos para acceder al módulo de activos.
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const { has } = usePermissions();
  const canReadAssets = has(['assets:read', 'assets:full_access']);

  if (!canReadAssets) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 p-6">
          <EmptyState />
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Link to="/" className="hover:text-slate-900 dark:hover:text-slate-100">
                Inicio
              </Link>
              <ChevronRight className="h-3 w-3" />
              <Link
                to="/inventario"
                className="hover:text-slate-900 dark:hover:text-slate-100"
              >
                Inventario
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-slate-900 font-medium dark:text-slate-100">
                Activos
              </span>
            </nav>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-lg md:text-xl font-bold tracking-tight">
                  Activos
                </h1>
                <p className="mt-1 text-xs md:text-sm text-slate-500 dark:text-slate-300">
                  Inventario de activos físicos y su estado operativo.
                </p>
              </div>

              <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 self-start dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                <Wrench className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" />
                Submódulo
              </span>
            </div>
          </div>
        </header>

        <section className="flex-1 min-h-0 overflow-auto bg-slate-100/60 dark:bg-slate-950">
          <div className="px-4 md:px-6 lg:px-8 py-6">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-4 md:p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <AssetsBoard />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
