import { useState, useEffect, useCallback } from 'react';
import type { CSVColumnConfig } from '@/components/ui/CSVExportSettings';

const STORAGE_PREFIX = 'csv_export_preferences_';

export function useCSVExportPreferences(pageKey: string, defaultColumns: CSVColumnConfig[]) {
  const storageKey = `${STORAGE_PREFIX}${pageKey}`;
  
  const [columns, setColumns] = useState<CSVColumnConfig[]>(() => {
    // Load from localStorage on mount
    if (typeof window === 'undefined') return defaultColumns;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as CSVColumnConfig[];
        
        // Merge with default columns to handle new columns added in updates
        const savedMap = new Map(parsed.map(col => [col.id, col]));
        return defaultColumns.map(col => savedMap.get(col.id) || col);
      }
    } catch (error) {
      console.error('Failed to load CSV preferences:', error);
    }
    
    return defaultColumns;
  });

  const saveColumns = useCallback((newColumns: CSVColumnConfig[]) => {
    setColumns(newColumns);
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(newColumns));
    } catch (error) {
      console.error('Failed to save CSV preferences:', error);
    }
  }, [storageKey]);

  const resetColumns = useCallback(() => {
    setColumns(defaultColumns);
    
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to reset CSV preferences:', error);
    }
  }, [defaultColumns, storageKey]);

  return {
    columns,
    saveColumns,
    resetColumns,
  };
}
