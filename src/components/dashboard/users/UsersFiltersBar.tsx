import FilterBar from '../../ui/filters/FilterBar';
import {
  UsersFilters,
  type UsersFilterKey,
} from '../../../features/management/usersFilters';

type Props = {
  onApply: (values: Record<UsersFilterKey, unknown>) => void;
};

export default function UsersFiltersBar({ onApply }: Props) {
  return (
    <div className="people-filter-shell">
      <FilterBar<UsersFilterKey>
        schema={UsersFilters}
        onApply={onApply}
        defaultOpenDesktop={false}
        baseFilename="usuarios"
      />
    </div>
  );
}
