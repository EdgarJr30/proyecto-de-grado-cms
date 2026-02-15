import { useMemo, useState } from 'react';
import type {
  PartCategoryRow,
  PartCriticality,
  PartRow,
  UomRow,
} from '../../../../types/inventory';

export function usePartsFilters(props: {
  parts: PartRow[];
  uomById: Map<string, UomRow>;
  catById: Map<string, PartCategoryRow>;
}) {
  const { parts, uomById, catById } = props;

  const [q, setQ] = useState('');
  const [critFilter, setCritFilter] = useState<PartCriticality | ''>('');
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');

  const filteredParts = useMemo(() => {
    const query = q.trim().toLowerCase();

    return parts.filter((p) => {
      if (activeFilter === 'active' && !p.is_active) return false;
      if (activeFilter === 'inactive' && p.is_active) return false;
      if (critFilter && p.criticality !== critFilter) return false;

      if (!query) return true;

      const u = uomById.get(p.uom_id)?.code ?? '';
      const c = p.category_id ? (catById.get(p.category_id)?.name ?? '') : '';
      const hay =
        `${p.code ?? ''} ${p.name ?? ''} ${p.description ?? ''} ${u} ${c}`.toLowerCase();

      return hay.includes(query);
    });
  }, [parts, q, activeFilter, critFilter, uomById, catById]);

  return {
    q,
    setQ,
    critFilter,
    setCritFilter,
    activeFilter,
    setActiveFilter,
    filteredParts,
    totalCount: filteredParts.length,
  };
}
