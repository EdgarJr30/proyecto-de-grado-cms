// src/types/Asset.ts
// Tipos para el módulo de Activos (assets) + relaciones (ticket_assets) + logs/historial.
// Nota: bigint en Postgres suele venir como string desde Supabase (dependiendo de tu config).
// Por consistencia y seguridad, aquí tipamos ids bigint como `number | string`.
// Si en tu proyecto ya tipas bigint como `number`, cambia BigIntLike a `number`.

export type BigIntLike = number | string;
export type UUID = string;
export type ISODate = string; // 'YYYY-MM-DD'
export type ISOTimestamp = string; // timestamptz ISO string

// ============ ENUMS ============
export type AssetStatus =
  | 'OPERATIVO'
  | 'EN_MANTENIMIENTO'
  | 'FUERA_DE_SERVICIO'
  | 'RETIRADO';

// ============ TABLE: public.assets ============
export interface Asset {
  id: number;
  code: string;
  name: string;
  description: string | null;
  location_id: number | null;
  category_id: number | null;
  asset_type: string | null;
  criticality: 1 | 2 | 3 | 4 | 5;
  status: AssetStatus;
  is_active: boolean;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  purchase_date: ISODate | null;
  install_date: ISODate | null;
  warranty_end_date: ISODate | null;
  purchase_cost: number | null;
  salvage_value: number | null;
  image_url: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  created_by: UUID | null;
  updated_by: UUID | null;
}

// Para inserts/updates desde el front (sin ids/auditoría)
export type AssetInsert = Omit<
  Asset,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
> & {
  id?: never;
};

export type AssetUpdate = Partial<
  Omit<Asset, 'id' | 'created_at' | 'created_by'>
> & {
  id: BigIntLike;
};

// ============ VIEW: public.v_assets ============
export interface AssetView extends Asset {
  location_name: string;
  location_code: string;
}

// ============ TABLE: public.asset_status_history ============
export interface AssetStatusHistory {
  id: BigIntLike;
  asset_id: BigIntLike;
  from_status: AssetStatus | null;
  to_status: AssetStatus;
  note: string | null;
  changed_at: ISOTimestamp;
  changed_by: UUID | null;
}

export type AssetStatusHistoryInsert = Omit<
  AssetStatusHistory,
  'id' | 'changed_at'
> & { id?: never };

export type AssetStatusHistoryUpdate = Partial<
  Omit<AssetStatusHistory, 'id' | 'asset_id'>
> & { id: BigIntLike; asset_id: BigIntLike };

// ============ TABLE: public.asset_maintenance_log ============
export interface AssetMaintenanceLog {
  id: BigIntLike;
  asset_id: BigIntLike;
  ticket_id: BigIntLike | null;
  maintenance_type: string; // PREVENTIVO, CORRECTIVO, INSPECCION, etc.
  summary: string;
  details: string | null;
  performed_at: ISOTimestamp;
  performed_by: string | null;
  labor_cost: number;
  parts_cost: number;
  other_cost: number;
  downtime_minutes: number;
  created_at: ISOTimestamp;
  created_by: UUID | null;
}

export type AssetMaintenanceLogInsert = Omit<
  AssetMaintenanceLog,
  'id' | 'created_at'
> & { id?: never };

export type AssetMaintenanceLogUpdate = Partial<
  Omit<AssetMaintenanceLog, 'id' | 'asset_id' | 'created_at' | 'created_by'>
> & { id: BigIntLike; asset_id: BigIntLike };

// ============ TABLE: public.ticket_assets ============
export interface TicketAsset {
  ticket_id: BigIntLike;
  asset_id: BigIntLike;
  is_primary: boolean;
  created_at: ISOTimestamp;
  created_by: UUID | null;
}

export type TicketAssetInsert = Omit<TicketAsset, 'created_at'>;
export type TicketAssetUpdate = Partial<
  Omit<TicketAsset, 'ticket_id' | 'asset_id'>
> & {
  ticket_id: BigIntLike;
  asset_id: BigIntLike;
};

// ============ VIEW: public.v_asset_tickets ============
// Importante: esta vista expone t.* (tickets) + ta.asset_id + location_name.
// Como tu tipo Ticket ya existe en el proyecto, aquí damos un tipo genérico.
// Si quieres, puedes reemplazar `TicketCompat` por tu `Ticket` real.
export type TicketCompat = Record<string, unknown>;

export interface AssetTicketView extends TicketCompat {
  asset_id: BigIntLike;
  location_name: string | null;
}

// ============ UI helpers (opcionales, pero útiles) ============
export type AssetCriticality = 1 | 2 | 3 | 4 | 5;

export interface AssetListRow {
  id: BigIntLike;
  code: string;
  name: string;
  category: string | null;
  status: AssetStatus;
  criticality: AssetCriticality;
  location_id: BigIntLike;
  location_name?: string | null;
  next_maintenance?: ISODate | null; // si luego lo calculas por view/rpc
  cost_ytd?: number | null; // si luego lo calculas por view/rpc
  image_url?: string | null;
}
