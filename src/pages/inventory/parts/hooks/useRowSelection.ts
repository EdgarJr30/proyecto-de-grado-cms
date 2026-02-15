import { useEffect, useMemo, useRef, useState } from 'react';

export function useRowSelection<T>(props: { items: T[] }) {
  const { items } = props;

  const checkboxRef = useRef<HTMLInputElement>(null);

  const [selectedRows, setSelectedRows] = useState<T[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const itemsCount = items.length;
  const selectedCount = selectedRows.length;

  useEffect(() => {
    const nextChecked = itemsCount > 0 && selectedCount === itemsCount;
    const nextIndeterminate = selectedCount > 0 && selectedCount < itemsCount;

    setChecked(nextChecked);
    setIndeterminate(nextIndeterminate);

    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = nextIndeterminate;
    }
  }, [itemsCount, selectedCount]);

  useEffect(() => {
    setSelectedRows((prev) => prev.filter((x) => items.includes(x)));
  }, [items]);

  const toggleAll = useMemo(() => {
    return () => {
      setSelectedRows(checked || indeterminate ? [] : items);
      setChecked(!checked && !indeterminate);
      setIndeterminate(false);
      if (checkboxRef.current) checkboxRef.current.indeterminate = false;
    };
  }, [checked, indeterminate, items]);

  return {
    checkboxRef,
    selectedRows,
    setSelectedRows,
    checked,
    indeterminate,
    toggleAll,
  };
}
