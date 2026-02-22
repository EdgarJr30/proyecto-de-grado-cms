import { useMemo } from 'react';
import FilterBar from '../../ui/filters/FilterBar';
import {
  WorkRequestsFilters,
  type WorkRequestsFilterKey,
} from '../../../features/tickets/workRequestsFilters';
import { useLocationCatalog } from '../../../hooks/useLocationCatalog';

type Props = {
  onApply: (values: Record<WorkRequestsFilterKey, unknown>) => void;
};

export default function WorkRequestsFiltersBar({ onApply }: Props) {
  const { filterOptions } = useLocationCatalog({
    includeInactive: false,
    activeOnlyOptions: true,
  });

  const schema = useMemo(
    () => ({
      ...WorkRequestsFilters,
      fields: WorkRequestsFilters.fields.map((field) =>
        field.key === 'location_id' && field.type === 'select'
          ? { ...field, options: filterOptions }
          : field
      ),
    }),
    [filterOptions]
  );

  return (
    <div className="wr-filter-shell">
      <FilterBar<WorkRequestsFilterKey>
        schema={schema}
        onApply={onApply}
        defaultOpenDesktop={false}
        exportMerge={{ is_accepted: false }}
        baseFilename="solicitudes"
      />
    </div>
  );
}
