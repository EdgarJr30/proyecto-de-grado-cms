import Sidebar from '../components/layout/Sidebar';
import ReportsDashboard from '../components/reports/ReportsDashboard';

export default function ReportsPage() {
  return (
    <div className="h-screen flex bg-gray-100 dark:bg-slate-950">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <section className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
          <ReportsDashboard />
        </section>
      </main>
    </div>
  );
}
