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
    <FilterBar<WorkRequestsFilterKey>
      schema={WorkRequestsFilters}
      onApply={onApply}
      sticky
      exportMerge={{ is_accepted: false }}
      baseFilename="solicitudes"
    />
  );
}
