import FilterBar from '../../ui/filters/FilterBar';
import {
  WorkOrdersFilters,
  type WorkOrdersFilterKey,
} from '../../../features/tickets/WorkOrdersFilters';

type Props = {
  onApply: (values: Record<WorkOrdersFilterKey, unknown>) => void;
};

export default function WorkOrdersFiltersBar({ onApply }: Props) {
  return (
    <div className="wo-filter-shell">
      <FilterBar<WorkOrdersFilterKey>
        schema={WorkOrdersFilters}
        onApply={onApply}
        defaultOpenDesktop={false}
        exportMerge={{ is_accepted: true }}
        baseFilename="ordenes_trabajo"
      />
    </div>
  );
}
