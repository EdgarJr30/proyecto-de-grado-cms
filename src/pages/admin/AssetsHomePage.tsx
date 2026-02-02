import AssetsBoard from '../../components/dashboard/admin/assets/AssetsBoard';
import Sidebar from '../../components/layout/Sidebar';

export default function AssetsHomePage() {
  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Activos</h1>
            <p className="text-sm text-gray-500">
              Maneja los activos del sistema.
            </p>
          </div>
        </header>

        <section className="flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-4 pb-8">
          <AssetsBoard />
        </section>
      </main>
    </div>
  );
}
