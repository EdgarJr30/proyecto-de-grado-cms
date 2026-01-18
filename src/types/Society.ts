export type Society = {
  id: number;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SocietyFormState = {
  id?: number;
  name: string;
  logo_url: string | null;
  is_active: boolean;
};

export const EMPTY_SOCIETY_FORM: SocietyFormState = {
  name: '',
  logo_url: null,
  is_active: true,
};
