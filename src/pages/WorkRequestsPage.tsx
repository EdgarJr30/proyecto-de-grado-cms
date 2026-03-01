import { useMemo, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import WorkRequestsBoard from '../components/dashboard/workRequest/WorkRequestsBoard';
import WorkRequestsFiltersBar from '../components/dashboard/workRequest/WorkRequestsFiltersBar';

import type { FilterState } from '../types/filters';
import type { WorkRequestsFilterKey } from '../features/tickets/workRequestsFilters';
import { motion, useReducedMotion } from 'framer-motion';
import '../styles/workRequestsAsana.css';

export default function WorkRequestsPage() {
  const prefersReducedMotion = useReducedMotion();
  // 🔁 Filtros avanzados (ÚNICA fuente de verdad)
  const [filters, setFilters] = useState<
    Record<WorkRequestsFilterKey, unknown>
  >({} as Record<WorkRequestsFilterKey, unknown>);

  const mergedFilters = useMemo<FilterState<WorkRequestsFilterKey>>(
    () => filters as FilterState<WorkRequestsFilterKey>,
    [filters]
  );

  return (
    <div className="wr-asana h-screen flex bg-[#f3f4f8] dark:bg-slate-950">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <motion.div
          className="wr-filters px-4 md:px-6 lg:px-8 pt-3"
          initial={
            prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.998 }
          }
          animate={
            prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.32, ease: [0.2, 0.8, 0.2, 1], delay: 0.05 }
          }
        >
          <WorkRequestsFiltersBar
            onApply={(vals) => {
              setFilters((prev) =>
                JSON.stringify(prev) === JSON.stringify(vals) ? prev : vals
              );
            }}
          />
        </motion.div>

        <motion.section
          className="wr-content flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-3 pb-6"
          initial={
            prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.998 }
          }
          animate={
            prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.35, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 }
          }
        >
          {/* ✅ Ahora el board recibe filters en lugar de searchTerm/location_id */}
          <WorkRequestsBoard filters={mergedFilters} />
        </motion.section>
      </main>
    </div>
  );
}
