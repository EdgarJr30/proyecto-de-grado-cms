import type { FilterSchema } from '../../types/filters';

export type TechniciansFilterKey = 'q' | 'section' | 'include_inactive';

export const TechniciansFilters: FilterSchema<TechniciansFilterKey> = {
  id: 'technicians_management',
  fields: [
    {
      key: 'q',
      type: 'text',
      label: 'Buscar',
      placeholder: 'Buscar por nombre, apellido, email o teléfono…',
      responsive: 'bar',
      minChars: 2,
      immediate: true,
    },
    {
      key: 'section',
      type: 'select',
      label: 'Todas las secciones',
      options: [
        { label: 'TODOS', value: 'TODOS' },
        { label: 'SIN ASIGNAR', value: 'SIN ASIGNAR' },
        { label: 'Internos', value: 'Internos' },
        { label: 'TERCEROS', value: 'TERCEROS' },
        { label: 'OTROS', value: 'OTROS' },
      ],
      responsive: 'bar',
      immediate: true,
      defaultValue: 'TODOS',
    },
    {
      key: 'include_inactive',
      type: 'boolean',
      label: 'Mostrar inactivos',
      responsive: 'bar',
      immediate: true,
    },
  ],
};
