import type { FilterSchema } from '../../types/filters';

export type UsersFilterKey = 'q' | 'location_id' | 'include_inactive';

export const UsersFilters: FilterSchema<UsersFilterKey> = {
  id: 'users_management',
  fields: [
    {
      key: 'q',
      type: 'text',
      label: 'Buscar',
      placeholder: 'Buscar por nombre, apellido o email…',
      responsive: 'bar',
      minChars: 2,
      immediate: true,
    },
    {
      key: 'location_id',
      type: 'select',
      label: 'Todas las ubicaciones',
      options: [],
      responsive: 'bar',
      immediate: true,
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
