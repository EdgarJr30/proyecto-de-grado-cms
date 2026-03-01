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
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 p-6">
          <EmptyState />
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <section className="flex-1 min-h-0 overflow-auto bg-slate-100/60 dark:bg-slate-950 pt-6">
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
