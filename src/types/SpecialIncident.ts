export interface SpecialIncident {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active: boolean;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  created_by: string;          // uuid
  updated_by?: string | null;  // uuid | null
}