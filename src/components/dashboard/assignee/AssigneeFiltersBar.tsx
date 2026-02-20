import FilterBar from '../../ui/filters/FilterBar';
import {
  TechniciansFilters,
  type TechniciansFilterKey,
} from '../../../features/management/techniciansFilters';

type Props = {
  onApply: (values: Record<TechniciansFilterKey, unknown>) => void;
};

export default function AssigneeFiltersBar({ onApply }: Props) {
  return (
    <div className="people-filter-shell">
      <FilterBar<TechniciansFilterKey>
        schema={TechniciansFilters}
        onApply={onApply}
        defaultOpenDesktop={false}
        baseFilename="tecnicos"
      />
    </div>
  );
}
