import { useMemo, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import TechniciansTable from '../../components/dashboard/assignee/AssigneeTable';
import AssigneeFiltersBar from '../../components/dashboard/assignee/AssigneeFiltersBar';
import type { FilterState } from '../../types/filters';
import type { TechniciansFilterKey } from '../../features/management/techniciansFilters';
import type { AssigneeSection } from '../../types/Assignee';
import { motion, useReducedMotion } from 'framer-motion';
import '../../styles/peopleAsana.css';

const VALID_SECTIONS = new Set<AssigneeSection | 'TODOS'>([
  'TODOS',
  'SIN ASIGNAR',
  'Internos',
  'TERCEROS',
  'OTROS',
]);

export default function AssigneeManagementPage() {
  const prefersReducedMotion = useReducedMotion();
  const [filters, setFilters] = useState<Record<TechniciansFilterKey, unknown>>(
    {} as Record<TechniciansFilterKey, unknown>
  );

  const mergedFilters = useMemo<FilterState<TechniciansFilterKey>>(
    () => filters as FilterState<TechniciansFilterKey>,
    [filters]
  );

  const searchTerm =
    typeof mergedFilters.q === 'string' ? mergedFilters.q : '';
  const sectionCandidate =
    typeof mergedFilters.section === 'string' ? mergedFilters.section : 'TODOS';
  const sectionFilter: AssigneeSection | 'TODOS' = VALID_SECTIONS.has(
    sectionCandidate as AssigneeSection | 'TODOS'
  )
    ? (sectionCandidate as AssigneeSection | 'TODOS')
    : 'TODOS';
  const includeInactive = Boolean(mergedFilters.include_inactive);

  return (
    <div className="people-asana h-screen flex bg-[#f3f4f8] dark:bg-slate-950">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <motion.div
          className="people-filters px-4 md:px-6 lg:px-8 pt-3"
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
          <AssigneeFiltersBar
            onApply={(vals) => {
              setFilters((prev) =>
                JSON.stringify(prev) === JSON.stringify(vals) ? prev : vals
              );
            }}
          />
        </motion.div>

        <motion.section
          className="people-content flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-3 pb-6"
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
          <TechniciansTable
            searchTerm={searchTerm}
            sectionFilter={sectionFilter}
            includeInactive={includeInactive}
          />
        </motion.section>
      </main>
    </div>
  );
}
