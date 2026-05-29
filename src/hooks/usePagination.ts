import { useState, useCallback } from 'react';

interface PaginationOptions {
  initialPage?: number;
  page_size?: number;
}

interface PaginationResult {
  page: number;
  page_size: number;
  offset: number;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  reset: () => void;
}

export function usePagination(options: PaginationOptions = {}): PaginationResult {
  const { initialPage = 1, page_size = 20 } = options;
  const [page, setPage] = useState(initialPage);

  const nextPage = useCallback(() => setPage((p) => p + 1), []);
  const prevPage = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goToPage = useCallback((p: number) => setPage(Math.max(1, p)), []);
  const reset = useCallback(() => setPage(initialPage), [initialPage]);

  return {
    page,
    page_size,
    offset: (page - 1) * page_size,
    nextPage,
    prevPage,
    goToPage,
    reset,
  };
}
