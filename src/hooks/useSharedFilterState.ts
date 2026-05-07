/**
 * useSharedFilterState Hook
 * 
 * Shares filter state (centres, date range) across all pages via IndexedDB cache.
 * When user loads data on Dashboard, other pages will automatically use the same filters.
 */

import { useEffect, useState } from 'react';
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
      if (filterState.fromDate) setFromDate(filterState.fromDate);
      if (filterState.toDate) setToDate(filterState.toDate);
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

  // Update centres when filter state loads
  useEffect(() => {
    console.log('[useSharedCentres] Filter state update:', {
      loaded,
      filterState,
      selectedCentres: filterState?.selectedCentres
    });
    
    if (loaded && filterState?.selectedCentres) {
      console.log('[useSharedCentres] Setting centres:', filterState.selectedCentres);
      setSelectedCentres(filterState.selectedCentres);
    }
  }, [loaded, filterState]);

  // Poll for filter state updates (check immediately and every 1 second)
  useEffect(() => {
    // Check immediately on mount
    (async () => {
      try {
        const cached = await getCache(CACHE_KEYS.FILTER_STATE);
        if (cached?.selectedCentres && JSON.stringify(cached.selectedCentres) !== JSON.stringify(selectedCentres)) {
          console.log('[useSharedCentres] Initial check - detected filter state:', cached.selectedCentres);
          setSelectedCentres(cached.selectedCentres);
        }
      } catch (err) {
        console.error('Failed to check filter state:', err);
      }
    })();

    // Then poll every 1 second
    const interval = setInterval(async () => {
      try {
        const cached = await getCache(CACHE_KEYS.FILTER_STATE);
        if (cached?.selectedCentres && JSON.stringify(cached.selectedCentres) !== JSON.stringify(selectedCentres)) {
          console.log('[useSharedCentres] Polling detected filter state change:', cached.selectedCentres);
          setSelectedCentres(cached.selectedCentres);
        }
      } catch (err) {
        console.error('Failed to poll filter state:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedCentres]);

  return [selectedCentres, setSelectedCentres, loaded];
}
// Improved memoization

// Improved memoization
