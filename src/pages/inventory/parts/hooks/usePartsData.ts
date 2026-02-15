import { useEffect, useMemo, useState } from 'react';
import type {
  PartCategoryRow,
  PartRow,
  UomRow,
} from '../../../../types/inventory';
import {
  listPartCategories,
  listParts,
  listUoms,
} from '../../../../services/inventory';
import { showToastError } from '../../../../notifications';

export function usePartsData(props: { canRead: boolean }) {
  const { canRead } = props;

  const [isLoading, setIsLoading] = useState(true);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [uoms, setUoms] = useState<UomRow[]>([]);
  const [categories, setCategories] = useState<PartCategoryRow[]>([]);

  const uomById = useMemo(() => new Map(uoms.map((u) => [u.id, u])), [uoms]);
  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  async function reload() {
    if (!canRead) return;
    setIsLoading(true);
    try {
      const [u, c, p] = await Promise.all([
        listUoms({ limit: 1000, offset: 0, orderBy: 'code', ascending: true }),
        listPartCategories({
          limit: 2000,
          offset: 0,
          orderBy: 'name',
          ascending: true,
        }),
        listParts({ limit: 1000, offset: 0, orderBy: 'code', ascending: true }),
      ]);
      setUoms(u);
      setCategories(c);
      setParts(p);
    } catch (e: unknown) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando repuestos'
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!canRead) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  return { isLoading, parts, uoms, categories, uomById, catById, reload };
}
