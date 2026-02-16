import type { PartCategoryRow } from '../../../../../types/inventory';

export type FormState = {
  id?: string;
  name: string;
  parent_id: string | null;
};

export const EMPTY_FORM: FormState = { name: '', parent_id: null };

export type CategoryHelpers = {
  labelOf: (id: string | null) => string | null;
  breadcrumbOf: (id: string) => string;
};

export type SelectionState = {
  selectedRows: PartCategoryRow[];
  checked: boolean;
  indeterminate: boolean;
};
