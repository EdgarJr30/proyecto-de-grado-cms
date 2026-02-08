export type UUID = string;
export type BigIntLike = number;

export type AuditFields = {
  created_at: string;
  updated_at: string;
  created_by: UUID | null;
  updated_by: UUID | null;
};

export type DbResult<T> = {
  data: T;
};

export type ListParams = {
  limit?: number;
  offset?: number;
  orderBy?: string;
  ascending?: boolean;
};
