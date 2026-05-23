import { useMemo, useState } from 'react';

export const usePagination = (items = [], pageSize = 50) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const paginatedItems = useMemo(() => {
    const start = (Math.min(page, totalPages) - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize, totalPages]);

  return {
    page: Math.min(page, totalPages),
    pageSize,
    totalPages,
    totalItems: items.length,
    paginatedItems,
    setPage,
    nextPage: () => setPage((current) => Math.min(current + 1, totalPages)),
    previousPage: () => setPage((current) => Math.max(current - 1, 1)),
  };
};
