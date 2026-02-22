import { useMemo } from 'react';
import FilterBar from '../../ui/filters/FilterBar';
import {
  UsersFilters,
  type UsersFilterKey,
} from '../../../features/management/usersFilters';
import { useLocationCatalog } from '../../../hooks/useLocationCatalog';

type Props = {
  onApply: (values: Record<UsersFilterKey, unknown>) => void;
};

export default function UsersFiltersBar({ onApply }: Props) {
  const { filterOptions } = useLocationCatalog({
    includeInactive: false,
    activeOnlyOptions: true,
  });

  const schema = useMemo(
    () => ({
      ...UsersFilters,
      fields: UsersFilters.fields.map((field) =>
        field.key === 'location_id' && field.type === 'select'
          ? { ...field, options: filterOptions }
          : field
      ),
    }),
    [filterOptions]
  );

  return (
    <div className="people-filter-shell">
      <FilterBar<UsersFilterKey>
        schema={schema}
        onApply={onApply}
        defaultOpenDesktop={false}
        baseFilename="usuarios"
      />
    </div>
  );
}
