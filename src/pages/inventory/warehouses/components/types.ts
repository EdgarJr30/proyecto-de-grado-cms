import type { WarehouseRow } from '../../../../types/inventory';

export type FormState = {
  code: string;
  name: string;
  location_label: string;
  is_active: boolean;
};

export function toFormDefaults(warehouse?: WarehouseRow): FormState {
  return {
    code: warehouse?.code ?? '',
    name: warehouse?.name ?? '',
    location_label: warehouse?.location_label ?? '',
    is_active: warehouse?.is_active ?? true,
  };
}
