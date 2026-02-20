import { useMemo, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import WorkRequestsBoard from '../components/dashboard/workRequest/WorkRequestsBoard';
import WorkRequestsFiltersBar from '../components/dashboard/workRequest/WorkRequestsFiltersBar';

import type { FilterState } from '../types/filters';
import type { WorkRequestsFilterKey } from '../features/tickets/workRequestsFilters';
import '../styles/workRequestsAsana.css';

export default function WorkRequestsPage() {
  // 🔁 Filtros avanzados (ÚNICA fuente de verdad)
  const [filters, setFilters] = useState<
    Record<WorkRequestsFilterKey, unknown>
  >({} as Record<WorkRequestsFilterKey, unknown>);

  const mergedFilters = useMemo<FilterState<WorkRequestsFilterKey>>(
    () => filters as FilterState<WorkRequestsFilterKey>,
    [filters]
  );

  return (
    <div className="wr-asana h-screen flex bg-[#f3f4f8]">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <header className="wr-page-header px-4 md:px-6 lg:px-8 py-3 md:py-4">
          <div className="wr-header-row flex items-center justify-between gap-3">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Solicitudes
            </h2>
          </div>
        </header>

        <div className="wr-filters px-4 md:px-6 lg:px-8 pt-2">
          <WorkRequestsFiltersBar
            onApply={(vals) => {
              setFilters((prev) =>
                JSON.stringify(prev) === JSON.stringify(vals) ? prev : vals
              );
            }}
          />
        </div>

        <section className="wr-content flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-2 pb-6">
          {/* ✅ Ahora el board recibe filters en lugar de searchTerm/location_id */}
          <WorkRequestsBoard filters={mergedFilters} />
        </section>
      </main>
    </div>
  );
}
