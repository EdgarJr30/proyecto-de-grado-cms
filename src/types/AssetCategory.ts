export type AssetCategory = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AssetCategoryInsert = {
  name: string;
  description: string | null;
  is_active: boolean;
};

export type AssetCategoryUpdate = Partial<AssetCategoryInsert>;
