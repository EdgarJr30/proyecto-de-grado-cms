import type { PartCategoryRow } from '../../../../../types/inventory';
import type { CategoryHelpers } from './types';

export function buildCategoryLabelMap(
  rows: PartCategoryRow[]
): CategoryHelpers {
  const byId = new Map<string, PartCategoryRow>();
  rows.forEach((r) => byId.set(r.id, r));

  const labelOf = (id: string | null) => {
    if (!id) return null;
    const r = byId.get(id);
    return r ? r.name : null;
  };

  const breadcrumbOf = (id: string) => {
    const seen = new Set<string>();
    const parts: string[] = [];

    let cur = byId.get(id) ?? null;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      parts.unshift(cur.name);
      cur = cur.parent_id ? (byId.get(cur.parent_id) ?? null) : null;
    }

    return parts.join(' / ');
  };

  return { labelOf, breadcrumbOf };
}
