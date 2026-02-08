import type { AuditFields, UUID } from './common';
import type { PartCriticality } from './enums';

export type UomRow = AuditFields & {
  id: UUID;
  code: string;
  name: string;
};

export type UomInsert = Partial<
  Pick<AuditFields, 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>
> & {
  id?: UUID;
  code: string;
  name: string;
};

export type UomUpdate = Partial<
  Omit<UomRow, 'id' | 'created_at' | 'created_by'>
>;

export type PartCategoryRow = AuditFields & {
  id: UUID;
  name: string;
  parent_id: UUID | null;
};

export type PartCategoryInsert = {
  id?: UUID;
  name: string;
  parent_id?: UUID | null;
};

export type PartCategoryUpdate = Partial<
  Omit<PartCategoryRow, 'id' | 'created_at' | 'created_by'>
>;

export type PartRow = AuditFields & {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  category_id: UUID | null;
  uom_id: UUID;
  criticality: PartCriticality;
  is_active: boolean;
  is_stocked: boolean;
};

export type PartInsert = {
  id?: UUID;
  code: string;
  name: string;
  description?: string | null;
  category_id?: UUID | null;
  uom_id: UUID;
  criticality?: PartCriticality;
  is_active?: boolean;
  is_stocked?: boolean;
};

export type PartUpdate = Partial<
  Omit<PartRow, 'id' | 'created_at' | 'created_by'>
>;

export type VendorRow = AuditFields & {
  id: UUID;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
};

export type VendorInsert = {
  id?: UUID;
  name: string;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
};

export type VendorUpdate = Partial<
  Omit<VendorRow, 'id' | 'created_at' | 'created_by'>
>;

export type PartVendorRow = AuditFields & {
  id: UUID;
  part_id: UUID;
  vendor_id: UUID;
  vendor_part_code: string | null;
  lead_time_days: number | null;
  moq: number | null;
  last_price: number | null;
  currency: string | null;
  is_preferred: boolean;
};

export type PartVendorInsert = {
  id?: UUID;
  part_id: UUID;
  vendor_id: UUID;
  vendor_part_code?: string | null;
  lead_time_days?: number | null;
  moq?: number | null;
  last_price?: number | null;
  currency?: string | null;
  is_preferred?: boolean;
};

export type PartVendorUpdate = Partial<
  Omit<PartVendorRow, 'id' | 'created_at' | 'created_by'>
>;
