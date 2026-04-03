import { useState, useMemo } from 'react';

export type SortOrder = 'asc' | 'desc';

export interface UseTableSortOptions<T, K extends keyof T> {
  data: T[];
  defaultSortKey: K;
  defaultSortOrder?: SortOrder;
}

export interface UseTableSortReturn<T, K extends keyof T> {
  sortedData: T[];
  sortBy: K;
  sortOrder: SortOrder;
  handleSort: (key: K) => void;
}

/**
 * Custom hook for table sorting
 * 
 * @example
 * const { sortedData, sortBy, sortOrder, handleSort } = useTableSort({
 *   data: myData,
 *   defaultSortKey: 'name',
 *   defaultSortOrder: 'asc'
 * });
 */
export function useTableSort<T, K extends keyof T>({
  data,
  defaultSortKey,
  defaultSortOrder = 'asc'
}: UseTableSortOptions<T, K>): UseTableSortReturn<T, K> {
  const [sortBy, setSortBy] = useState<K>(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultSortOrder);

  const handleSort = (key: K) => {
    if (sortBy === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      let comparison = 0;

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // String comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal, 'vi-VN');
      }
      // Number comparison
      else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      }
      // Boolean comparison
      else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        comparison = aVal === bVal ? 0 : aVal ? 1 : -1;
      }
      // Date comparison
      else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      }
      // Fallback to string comparison
      else {
        comparison = String(aVal).localeCompare(String(bVal), 'vi-VN');
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [data, sortBy, sortOrder]);

  return {
    sortedData,
    sortBy,
    sortOrder,
    handleSort
  };
}

/**
 * Custom hook for table sorting with custom comparator
 * Use this when you need custom sorting logic for specific columns
 */
export function useTableSortWithComparator<T, K extends string>({
  data,
  defaultSortKey,
  defaultSortOrder = 'asc',
  comparator
}: {
  data: T[];
  defaultSortKey: K;
  defaultSortOrder?: SortOrder;
  comparator: (a: T, b: T, sortBy: K) => number;
}) {
  const [sortBy, setSortBy] = useState<K>(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultSortOrder);

  const handleSort = (key: K) => {
    if (sortBy === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const comparison = comparator(a, b, sortBy);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [data, sortBy, sortOrder, comparator]);

  return {
    sortedData,
    sortBy,
    sortOrder,
    handleSort
  };
}

// Fixed null value sorting
// Fixed null value sorting
// Fixed null value handling
// Improved sort stability

// Fixed null handling
