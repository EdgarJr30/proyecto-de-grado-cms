import type { VendorInsert } from '../../../../types/inventory';

export type VendorsTab = 'vendors' | 'part-vendors';

export const EMPTY_VENDOR_FORM: VendorInsert = {
  name: '',
  email: null,
  phone: null,
  is_active: true,
};
