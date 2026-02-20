import FilterBar from '../../ui/filters/FilterBar';
import {
  WorkRequestsFilters,
  type WorkRequestsFilterKey,
} from '../../../features/tickets/workRequestsFilters';

type Props = {
  onApply: (values: Record<WorkRequestsFilterKey, unknown>) => void;
};

export default function WorkRequestsFiltersBar({ onApply }: Props) {
  return (
    <div className="wr-filter-shell">
      <FilterBar<WorkRequestsFilterKey>
        schema={WorkRequestsFilters}
        onApply={onApply}
        defaultOpenDesktop={false}
        exportMerge={{ is_accepted: false }}
        baseFilename="solicitudes"
      />
    </div>
  );
}
