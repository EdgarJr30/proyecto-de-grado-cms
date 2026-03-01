import { useEffect, useMemo, useState } from 'react';

export function useClientPagination<T>(
  items: T[],
  options?: { initialPageSize?: number }
) {
  const initialPageSize = options?.initialPageSize ?? 50;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(pageSize, 1)));

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(prev, 1), totalPages));
  }, [totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  function goToPage(nextPage: number) {
    const clamped = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(clamped);
  }

  function goPrev() {
    goToPage(page - 1);
  }

  function goNext() {
    goToPage(page + 1);
  }

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    totalPages,
    rangeStart,
    rangeEnd,
    pagedItems,
    goToPage,
    goPrev,
    goNext,
    canPrev: page > 1,
    canNext: page < totalPages,
  };
}
