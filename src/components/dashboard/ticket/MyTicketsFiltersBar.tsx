import FilterBar from '../../ui/filters/FilterBar';
import {
  MyTicketsFilters,
  type MyTicketsFilterKey,
} from '../../../features/management/myTicketsFilters';

type Props = {
  onApply: (values: Record<MyTicketsFilterKey, unknown>) => void;
};

export default function MyTicketsFiltersBar({ onApply }: Props) {
  return (
    <div className="people-filter-shell">
      <FilterBar<MyTicketsFilterKey>
        schema={MyTicketsFilters}
        onApply={onApply}
        defaultOpenDesktop={false}
        baseFilename="mis_tickets"
      />
    </div>
  );
}
