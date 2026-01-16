// src/features/tickets/WorkOrdersFilters.ts
import type { FilterSchema } from '../../types/filters';
import { LOCATIONS } from '../../constants/locations';

export type WorkOrdersFilterKey =
  | 'q'
  | 'status'
  | 'priority'
  | 'location'
  | 'created_at'
  | 'has_image';

export const WorkOrdersFilters: FilterSchema<WorkOrdersFilterKey> = {
  id: 'work_orders',
  fields: [
    {
      key: 'q',
      type: 'text',
      label: 'Buscar',
      placeholder: 'Buscar por id, título, solicitante…',
      responsive: 'bar',
      minChars: 2, 
      immediate: true,
    },
    {
      key: 'status',
      type: 'multiselect',
      label: 'Todos los estados',
      options: [
        { label: 'Pendiente', value: 'Pendiente' },
        { label: 'En Ejecución', value: 'En Ejecución' },
        { label: 'Finalizadas', value: 'Finalizadas' },
      ],
      responsive: 'bar',
    },
    {
      key: 'priority',
      type: 'multiselect',
      label: 'Todas las prioridades',
      options: [
        { label: 'Baja', value: 'baja' },
        { label: 'Media', value: 'media' },
        { label: 'Alta', value: 'alta' },
      ],
      responsive: 'bar',
    },
    {
      key: 'location',
      type: 'select',
      label: 'Todas las ubicaciones',
      options: LOCATIONS.map((l) => ({ label: l, value: l })),
      responsive: 'bar',
      immediate: true,
    },
    // Secundarios (van en el drawer del FilterBar)
    {
      key: 'created_at',
      type: 'daterange',
      label: 'Fecha de creación',
      responsive: 'drawer',
    },
    {
      key: 'has_image',
      type: 'boolean',
      label: 'Con imágenes',
      responsive: 'drawer',
    },
  ],
};
