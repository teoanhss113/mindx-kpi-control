import { useMemo } from 'react';
import { SelectOption } from '@/components/ui';

/**
 * useFilterOptions - Generate filter options from data array
 * 
 * Standardizes the pattern of extracting unique values from data
 * and converting them to SelectOption[] format.
 * 
 * @example
 * // Simple usage
 * const statusOptions = useFilterOptions(
 *   classes,
 *   (cls) => cls.status
 * );
 * 
 * @example
 * // With seed values (pre-populate known values)
 * const statusOptions = useFilterOptions(
 *   tickets,
 *   (t) => t.status,
 *   { seedValues: ['NEW', 'ASSIGNED', 'IN_PROCESS', 'RESOLVED', 'CLOSED'] }
 * );
 * 
 * @example
 * // With custom label formatter
 * const reasonOptions = useFilterOptions(
 *   classes,
 *   (cls) => cls.reason,
 *   { 
 *     labelFormatter: (value) => `${REASON_LABELS[value] || value} (${count})`
 *   }
 * );
 */
export function useFilterOptions<T>(
  data: T[],
  accessor: (item: T) => string | undefined | null,
  options?: {
    /** Sort options alphabetically (default: true) */
    sort?: boolean;
    /** Custom label formatter */
    labelFormatter?: (value: string) => string;
    /** Pre-populate with known values (useful for enums) */
    seedValues?: string[];
  }
): SelectOption[] {
  return useMemo(() => {
    const seen = new Set<string>();
    
    // Add seed values first (if provided)
    options?.seedValues?.forEach(v => seen.add(v));
    
    // Extract values from data
    data.forEach(item => {
      const value = accessor(item);
      if (value) seen.add(value);
    });
    
    // Convert to array
    const values = Array.from(seen);
    
    // Sort if needed (default: true)
    if (options?.sort !== false) {
      values.sort();
    }
    
    // Map to SelectOption format
    return values.map(v => ({
      value: v,
      label: options?.labelFormatter ? options.labelFormatter(v) : v
    }));
  }, [data, accessor, options]);
}

// Simplified dependencies
// Simplified dependencies
// Simplified dependencies
// Improved useMemo usage

// Simplified deps
