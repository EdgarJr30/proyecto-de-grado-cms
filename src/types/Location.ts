export type Location = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type LocationInsert = {
  name: string;
  code: string;
  description?: string | null;
  is_active?: boolean;
};

export type LocationUpdate = {
  name?: string;
  code?: string;
  description?: string | null;
  is_active?: boolean;
};

// Útil para selects (dropdowns) sin cargar todo
export type LocationOption = Pick<Location, 'id' | 'name' | 'code'>;
