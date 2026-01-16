import type { FilterSchema } from '../../types/filters';
import { LOCATIONS } from '../../constants/locations';

export type WorkRequestsFilterKey =
  | 'q'
  | 'status'
  | 'priority'
  | 'location'
  | 'created_at'
  | 'has_image'
  | 'accepted';

export const WorkRequestsFilters: FilterSchema<WorkRequestsFilterKey> = {
  id: 'work_requests',
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
        // { label: 'Pendiente', value: 'Pendiente' },
        // { label: 'En Revisión', value: 'En Revisión' },
        // { label: 'Aprobada', value: 'Aprobada' },
        // { label: 'Convertida a OT', value: 'Convertida a OT' },
      ],
      responsive: 'bar',
    },
    {
      key: 'priority',
      type: 'multiselect',
      label: 'Todas las prioridades',
      options: [
        // { label: 'Baja', value: 'baja' },
        // { label: 'Media', value: 'media' },
        // { label: 'Alta', value: 'alta' },
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
    // Secundarios (drawer)
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
    {
      key: 'accepted',
      type: 'boolean',
      label: 'Solo aceptadas',
      responsive: 'bar',
    },
  ],
};
