import type { ReactNode } from 'react';
import FilterBar from '../../ui/filters/FilterBar';
import {
  MyTicketsFilters,
  type MyTicketsFilterKey,
} from '../../../features/management/myTicketsFilters';

type Props = {
  onApply: (values: Record<MyTicketsFilterKey, unknown>) => void;
  moduleTabs?: ReactNode;
  showFilters?: boolean;
};

export default function MyTicketsFiltersBar({
  onApply,
  moduleTabs,
  showFilters = true,
}: Props) {
  return (
    <div className="people-filter-shell">
      <FilterBar<MyTicketsFilterKey>
        schema={MyTicketsFilters}
        onApply={onApply}
        defaultOpenDesktop={false}
        baseFilename="mis_tickets"
        moduleTabs={moduleTabs}
        showFilters={showFilters}
      />
    </div>
  );
}
