import { useMemo, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import UsersTable from '../components/dashboard/users/UsersTable';
import UsersFiltersBar from '../components/dashboard/users/UsersFiltersBar';
import type { FilterState } from '../types/filters';
import type { UsersFilterKey } from '../features/management/usersFilters';
import '../styles/peopleAsana.css';

export default function UserManagementPage() {
  const [filters, setFilters] = useState<Record<UsersFilterKey, unknown>>(
    {} as Record<UsersFilterKey, unknown>
  );

  const mergedFilters = useMemo<FilterState<UsersFilterKey>>(
    () => filters as FilterState<UsersFilterKey>,
    [filters]
  );

  const searchTerm =
    typeof mergedFilters.q === 'string' ? mergedFilters.q : '';
  const selectedLocation =
    typeof mergedFilters.location_id === 'string'
      ? mergedFilters.location_id
      : '';
  const includeInactive = Boolean(mergedFilters.include_inactive);

  return (
    <div className="people-asana h-screen flex bg-[#f3f4f8]">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <header className="people-page-header px-4 md:px-6 lg:px-8 py-3 md:py-4">
          <div className="people-header-row flex items-center justify-between gap-3">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Usuarios
            </h2>
          </div>
        </header>

        <div className="people-filters px-4 md:px-6 lg:px-8 pt-2">
          <UsersFiltersBar
            onApply={(vals) => {
              setFilters((prev) =>
                JSON.stringify(prev) === JSON.stringify(vals) ? prev : vals
              );
            }}
          />
        </div>

        <section className="people-content flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-2 pb-6">
          <UsersTable
            searchTerm={searchTerm}
            selectedLocation={selectedLocation}
            includeInactive={includeInactive}
          />
        </section>
      </main>
    </div>
  );
}
