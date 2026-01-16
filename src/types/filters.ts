export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'ilike'
  | 'in'
  | 'between'
  | 'gte'
  | 'lte'
  | 'is_true'
  | 'is_false';

export type FilterValue =
  | string
  | number
  | boolean
  | (string | number)[]
  | { from?: string; to?: string }; // ISO date range

export type BaseField<T extends string = string> = {
  key: T;                 // clave única (ej: 'location', 'priority', 'created_at')
  label: string;          // etiqueta visible
  column?: string;        // si difiere del key en DB
  operator?: FilterOperator;
  hidden?: boolean;       // para tener campos “técnicos”
  defaultValue?: FilterValue;
  responsive?: 'bar' | 'drawer' | 'both'; // dónde aparece por defecto
  immediate?: boolean;
};

export type TextField<T extends string = string> = BaseField<T> & {
  type: 'text';
  placeholder?: string;
  minChars?: number; // para activar búsqueda a partir de N
};

export type SelectField<T extends string = string> = BaseField<T> & {
  type: 'select';
  options: { label: string; value: string | number }[];
  clearable?: boolean;
};

export type MultiSelectField<T extends string = string> = BaseField<T> & {
  type: 'multiselect';
  options: { label: string; value: string | number }[];
  maxTags?: number;
};

export type BooleanField<T extends string = string> = BaseField<T> & {
  type: 'boolean'; // toggle/checkbox
  trueLabel?: string;
  falseLabel?: string;
};

export type DateRangeField<T extends string = string> = BaseField<T> & {
  type: 'daterange';
  // formato ISO 'YYYY-MM-DD'; el adaptador hará between(column, from, to)
};

export type FilterField<T extends string = string> =
  | TextField<T>
  | SelectField<T>
  | MultiSelectField<T>
  | BooleanField<T>
  | DateRangeField<T>;

export type FilterSchema<T extends string = string> = {
  id: string;             // ej: 'tickets' | 'assignees'
  fields: FilterField<T>[];
  // map para columnas reales si lo prefieres centralizado
  columnMap?: Record<T, string>;
};

export type FilterState<T extends string = string> = Partial<
  Record<T, FilterValue>
>;
