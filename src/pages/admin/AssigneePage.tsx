import { useMemo, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import TechniciansTable from '../../components/dashboard/assignee/AssigneeTable';
import AssigneeFiltersBar from '../../components/dashboard/assignee/AssigneeFiltersBar';
import type { FilterState } from '../../types/filters';
import type { TechniciansFilterKey } from '../../features/management/techniciansFilters';
import type { AssigneeSection } from '../../types/Assignee';
import '../../styles/peopleAsana.css';

const VALID_SECTIONS = new Set<AssigneeSection | 'TODOS'>([
  'TODOS',
  'SIN ASIGNAR',
  'Internos',
  'TERCEROS',
  'OTROS',
]);

export default function AssigneeManagementPage() {
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
    <div className="people-asana h-screen flex bg-[#f3f4f8]">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <header className="people-page-header px-4 md:px-6 lg:px-8 py-3 md:py-4">
          <div className="people-header-row flex items-center justify-between gap-3">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Técnicos
            </h2>
          </div>
        </header>

        <div className="people-filters px-4 md:px-6 lg:px-8 pt-2">
          <AssigneeFiltersBar
            onApply={(vals) => {
              setFilters((prev) =>
                JSON.stringify(prev) === JSON.stringify(vals) ? prev : vals
              );
            }}
          />
        </div>

        <section className="people-content flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-2 pb-6">
          <TechniciansTable
            searchTerm={searchTerm}
            sectionFilter={sectionFilter}
            includeInactive={includeInactive}
          />
        </section>
      </main>
    </div>
  );
}
