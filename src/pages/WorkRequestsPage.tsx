import { useMemo, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/navigation/Navbar';
import WorkRequestsBoard from '../components/dashboard/workRequest/WorkRequestsBoard';
import WorkRequestsFiltersBar from '../components/dashboard/workRequest/WorkRequestsFiltersBar';

import type { FilterState } from '../types/filters';
import type { WorkRequestsFilterKey } from '../features/tickets/workRequestsFilters';

// type ViewMode = 'board' | 'list'; // por si luego agregas vista de lista

export default function WorkRequestsPage() {
  // 🔁 Filtros avanzados (ÚNICA fuente de verdad)
  const [filters, setFilters] = useState<
    Record<WorkRequestsFilterKey, unknown>
  >({} as Record<WorkRequestsFilterKey, unknown>);

  const mergedFilters = useMemo<FilterState<WorkRequestsFilterKey>>(
    () => filters as FilterState<WorkRequestsFilterKey>,
    [filters]
  );

  // Navbar PASIVO (no altera filtros)
  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        {/* 🧭 Navbar PASIVO */}
        <Navbar
          onSearch={() => {}} // no-op
          onFilterLocation={() => {}} // no-op
          selectedLocation="" // siempre vacío
        />

        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6">
          <h2 className="text-3xl font-bold">Solicitudes</h2>
        </header>

        <div className="px-4 md:px-6 lg:px-8 pt-3">
          <WorkRequestsFiltersBar
            onApply={(vals) => {
              setFilters((prev) =>
                JSON.stringify(prev) === JSON.stringify(vals) ? prev : vals
              );
            }}
          />
        </div>

        <section className="flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-4 pb-8">
          {/* ✅ Ahora el board recibe filters en lugar de searchTerm/location */}
          <WorkRequestsBoard filters={mergedFilters} />
        </section>
      </main>
    </div>
  );
}
