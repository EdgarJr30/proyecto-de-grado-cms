import type {
  FilterSchema,
  FilterState,
  FilterOperator,
  FilterField,
  FilterValue,
} from '../types/filters';

/**
 * Interfaz mínima del builder que necesitamos.
 * Evita acoplarse a los genéricos internos de Supabase y nos permite
 * tipar sin usar `any`. Los métodos devuelven el mismo tipo (fluidez).
 * 
 */

export type MinimalFilterBuilder<TSelf> = {
  eq: (column: string, value: unknown) => TSelf;
  neq: (column: string, value: unknown) => TSelf;
  ilike: (column: string, value: string) => TSelf;
  in: (column: string, values: unknown[]) => TSelf;
  gte: (column: string, value: unknown) => TSelf;
  lte: (column: string, value: unknown) => TSelf;
};

export type OrCapableBuilder<TSelf> = {
  or: (filters: string, options?: { referencedTable?: string }) => TSelf;
};

// Builder “mínimo” + capacidad de .or()
export type SupaQueryBuilder<TSelf> =
  MinimalFilterBuilder<TSelf> & OrCapableBuilder<TSelf>;

/** Utilidad: ¿un valor cuenta como “vacío” para filtros? */
function isEmptyFilterValue(v: FilterValue | undefined): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === 'object') {
    // daterange { from?: string; to?: string }
    const hasFrom =
      typeof v === 'object' &&
      v !== null &&
      Object.prototype.hasOwnProperty.call(v, 'from') &&
      (v as { from?: string }).from;
    const hasTo =
      typeof v === 'object' &&
      v !== null &&
      Object.prototype.hasOwnProperty.call(v, 'to') &&
      (v as { to?: string }).to;
    if (!hasFrom && !hasTo) return true;
  }
  return false;
}

/**
 * Aplica filtros de forma genérica a un query builder compatible.
 * - TKeys: union de llaves de filtros
 * - TQuery: tu builder (por ejemplo PostgrestFilterBuilder) siempre que cumpla MinimalFilterBuilder
 */
export function applyFilters<TKeys extends string, TQuery extends MinimalFilterBuilder<TQuery>>(
  query: TQuery,
  schema: FilterSchema<TKeys>,
  values: FilterState<TKeys>
): TQuery {
  let q = query;

  const getColumn = (f: FilterField<TKeys>): string =>
    f.column ?? schema.columnMap?.[f.key] ?? f.key;

  for (const f of schema.fields) {
    const column = getColumn(f);
    const v = values[f.key] as FilterValue | undefined;

    if (isEmptyFilterValue(v)) continue;

    const op: FilterOperator =
      f.operator ??
      (f.type === 'text'
        ? 'ilike'
        : f.type === 'multiselect'
        ? 'in'
        : f.type === 'daterange'
        ? 'between'
        : f.type === 'boolean'
        ? (v ? 'is_true' : 'is_false')
        : 'eq');

    switch (op) {
      case 'eq':
        q = q.eq(column, v as unknown);
        break;
      case 'neq':
        q = q.neq(column, v as unknown);
        break;
      case 'ilike': {
        const sv = String(v ?? '');
        q = q.ilike(column, `%${sv}%`);
        break;
      }
      case 'in': {
        const arr = Array.isArray(v) ? (v as unknown[]) : [v as unknown];
        q = q.in(column, arr);
        break;
      }
      case 'between': {
        const { from, to } = (v as { from?: string; to?: string }) || {};
        if (from) q = q.gte(column, from);
        if (to) q = q.lte(column, to);
        break;
      }
      case 'gte':
        q = q.gte(column, v as unknown);
        break;
      case 'lte':
        q = q.lte(column, v as unknown);
        break;
      case 'is_true':
        q = q.eq(column, true);
        break;
      case 'is_false':
        q = q.eq(column, false);
        break;
      default:
        // no-op
        break;
    }
  }

  return q;
}

