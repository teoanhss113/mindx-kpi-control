/**
 * useSharedFilterState Hook
 * 
 * Shares filter state (centres, date range) across all pages via IndexedDB cache.
 * When user loads data on Dashboard, other pages will automatically use the same filters.
 */

import { useEffect, useRef, useState } from 'react';
import { getCache, setCache } from '@/lib/idb';
import { CACHE_KEYS, DATE_UTILS } from '@/constants';

export interface SharedFilterState {
  selectedCentres: string[];
  fromDate: string;
  toDate: string;
  timestamp: number;
}

/**
 * Hook to load and save shared filter state
 * 
 * @param autoLoad - If true, automatically loads filter state on mount
 * @returns Object with filter state and save function
 */
export function useSharedFilterState(autoLoad = true) {
  const [filterState, setFilterState] = useState<SharedFilterState | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load filter state from cache on mount
  useEffect(() => {
    if (!autoLoad) return;
    
    async function load() {
      try {
        const cached = await getCache(CACHE_KEYS.FILTER_STATE);
        if (cached) {
          setFilterState(cached);
        }
      } catch (err) {
        console.error('Failed to load shared filter state:', err);
      } finally {
        setLoaded(true);
      }
    }
    
    load();
  }, [autoLoad]);

  // Save filter state to cache
  async function saveFilterState(state: Omit<SharedFilterState, 'timestamp'>) {
    try {
      const newState: SharedFilterState = {
        ...state,
        timestamp: Date.now(),
      };
      await setCache(CACHE_KEYS.FILTER_STATE, newState);
      setFilterState(newState);
    } catch (err) {
      console.error('Failed to save shared filter state:', err);
    }
  }

  return {
    filterState,
    loaded,
    saveFilterState,
  };
}

/**
 * Hook to initialize date range with shared state or default
 * 
 * @returns [fromDate, toDate, setFromDate, setToDate, loaded]
 */
export function useSharedDateRange(): [
  string,
  string,
  (date: string) => void,
  (date: string) => void,
  boolean
] {
  const { filterState, loaded } = useSharedFilterState();
  const defaultRange = DATE_UTILS.defaultMonthRange();
  
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);

  // Update dates when filter state loads
  useEffect(() => {
    if (loaded && filterState) {
      if (typeof filterState.fromDate === 'string') setFromDate(filterState.fromDate);
      if (typeof filterState.toDate === 'string') setToDate(filterState.toDate);
    }
  }, [loaded, filterState]);

  return [fromDate, toDate, setFromDate, setToDate, loaded];
}

/**
 * Hook to initialize selected centres with shared state
 * 
 * @returns [selectedCentres, setSelectedCentres, loaded]
 */
export function useSharedCentres(): [
  string[],
  (centres: string[]) => void,
  boolean
] {
  const { filterState, loaded } = useSharedFilterState();
  const [selectedCentres, setSelectedCentres] = useState<string[]>([]);
  // Timestamp of the cache version we last applied. Used so the poll only
  // syncs when cache was updated externally (other tab/page) — never clobbers
  // the user's local edits with a stale cached value.
  const lastAppliedTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (loaded && filterState?.selectedCentres && filterState.timestamp > lastAppliedTimestampRef.current) {
      lastAppliedTimestampRef.current = filterState.timestamp;
      setSelectedCentres(filterState.selectedCentres);
    }
  }, [loaded, filterState]);

  useEffect(() => {
    const apply = async () => {
      try {
        const cached = await getCache(CACHE_KEYS.FILTER_STATE);
        if (cached?.selectedCentres && cached.timestamp > lastAppliedTimestampRef.current) {
          lastAppliedTimestampRef.current = cached.timestamp;
          setSelectedCentres(cached.selectedCentres);
        }
      } catch (err) {
        console.error('Failed to check filter state:', err);
      }
    };

    apply();
    const interval = setInterval(apply, 1000);
    return () => clearInterval(interval);
  }, []);

  return [selectedCentres, setSelectedCentres, loaded];
}
// Improved memoization

// Improved memoization
