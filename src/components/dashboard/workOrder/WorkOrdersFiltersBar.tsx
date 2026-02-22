import { useMemo, type ReactNode } from 'react';
import FilterBar from '../../ui/filters/FilterBar';
import {
  WorkOrdersFilters,
  type WorkOrdersFilterKey,
} from '../../../features/tickets/WorkOrdersFilters';
import { useLocationCatalog } from '../../../hooks/useLocationCatalog';

type Props = {
  onApply: (values: Record<WorkOrdersFilterKey, unknown>) => void;
  moduleActions?: ReactNode;
};

export default function WorkOrdersFiltersBar({ onApply, moduleActions }: Props) {
  const { filterOptions } = useLocationCatalog({
    includeInactive: false,
    activeOnlyOptions: true,
  });

  const schema = useMemo(
    () => ({
      ...WorkOrdersFilters,
      fields: WorkOrdersFilters.fields.map((field) =>
        field.key === 'location_id' && field.type === 'select'
          ? { ...field, options: filterOptions }
          : field
      ),
    }),
    [filterOptions]
  );

  return (
    <div className="wo-filter-shell">
      <FilterBar<WorkOrdersFilterKey>
        schema={schema}
        onApply={onApply}
        defaultOpenDesktop={false}
        exportMerge={{ is_accepted: true }}
        baseFilename="ordenes_trabajo"
        moduleActions={moduleActions}
      />
    </div>
  );
}
