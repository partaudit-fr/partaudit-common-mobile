import { useState, useCallback } from 'react';

interface PaginationOptions {
  initialPage?: number;
  pageSize?: number;
}

interface PaginationResult {
  page: number;
  pageSize: number;
  offset: number;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  reset: () => void;
}

export function usePagination(options: PaginationOptions = {}): PaginationResult {
  const { initialPage = 1, pageSize = 20 } = options;
  const [page, setPage] = useState(initialPage);

  const nextPage = useCallback(() => setPage((p) => p + 1), []);
  const prevPage = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goToPage = useCallback((p: number) => setPage(Math.max(1, p)), []);
  const reset = useCallback(() => setPage(initialPage), [initialPage]);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    nextPage,
    prevPage,
    goToPage,
    reset,
  };
}
