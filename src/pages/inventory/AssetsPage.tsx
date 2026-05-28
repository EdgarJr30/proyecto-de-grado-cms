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
      <div className="h-[100dvh] overflow-hidden bg-[#f7f9fc] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <main className="h-[100dvh] overflow-hidden p-6">
          <EmptyState />
        </main>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full max-w-full overflow-hidden bg-[#f7f9fc] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="h-[100dvh] w-full max-w-full overflow-hidden">
        <section className="h-full w-full max-w-full overflow-hidden">
          <AssetsBoard />
        </section>
      </main>
    </div>
  );
}
