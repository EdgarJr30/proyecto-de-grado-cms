// src/components/dashboard/workOrder/WorkOrdersFiltersBar.tsx
import FilterBar from '../../ui/filters/FilterBar';
import {
  WorkOrdersFilters,
  type WorkOrdersFilterKey,
} from '../../../features/tickets/WorkOrdersFilters';

type Props = {
  onApply: (values: Record<WorkOrdersFilterKey, unknown>) => void;
};

export default function WorkOrdersFiltersBar({ onApply }: Props) {
  // ✅ pasa el genérico para que los tipos de clave coincidan
  return (
    <FilterBar<WorkOrdersFilterKey>
      schema={WorkOrdersFilters}
      onApply={onApply}
      sticky
      exportMerge={{ is_accepted: true }}
      baseFilename="ordenes_trabajo"
    />
  );
}
