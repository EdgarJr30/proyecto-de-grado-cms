import type { FilterSchema } from '../../types/filters';

export type MyTicketsFilterKey = 'q' | 'status' | 'priority' | 'created_at';

export const MyTicketsFilters: FilterSchema<MyTicketsFilterKey> = {
  id: 'my_tickets',
  fields: [
    {
      key: 'q',
      type: 'text',
      label: 'Buscar',
      placeholder: 'Buscar por id, título, descripción o solicitante…',
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
        { label: 'Baja', value: 'Baja' },
        { label: 'Media', value: 'Media' },
        { label: 'Alta', value: 'Alta' },
      ],
      responsive: 'bar',
    },
    {
      key: 'created_at',
      type: 'daterange',
      label: 'Fecha de creación',
      responsive: 'drawer',
    },
  ],
};
