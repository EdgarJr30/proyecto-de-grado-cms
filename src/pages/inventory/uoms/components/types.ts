export type FormState = {
  id?: string;
  code: string;
  name: string;
};

export const EMPTY_FORM: FormState = {
  code: '',
  name: '',
};
