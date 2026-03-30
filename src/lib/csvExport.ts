/**
 * CSV Export Utility
 * 
 * Provides utilities for exporting table data to CSV format with proper formatting
 * and support for Vietnamese characters.
 */

export interface CSVColumn<T = any> {
  /** Column header in CSV */
  header: string;
  /** Data accessor - can be a key or a function */
  accessor: keyof T | ((row: T) => any);
  /** Optional formatter for the value */
  formatter?: (value: any, row: T) => string;
}

/**
 * Export data to CSV file
 * 
 * @param data - Array of data objects to export
 * @param columns - Column definitions
 * @param filename - Base filename (without extension)
 */
export function exportToCSV<T>(
  data: T[],
  columns: CSVColumn<T>[],
  filename: string
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Generate CSV headers
  const headers = columns.map(col => col.header);
  
  // Generate CSV rows
  const rows = data.map(row => {
    return columns.map(col => {
      // Get value using accessor
      const value = typeof col.accessor === 'function'
        ? col.accessor(row)
        : row[col.accessor as keyof T];
      
      // Format value if formatter provided
      const formattedValue = col.formatter 
        ? col.formatter(value, row)
        : formatCSVValue(value);
      
      return formattedValue;
    });
  });
  
  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // Add BOM for proper UTF-8 encoding (Vietnamese characters)
  const blob = new Blob(['\uFEFF' + csvContent], { 
    type: 'text/csv;charset=utf-8;' 
  });
  
  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format a value for CSV output
 * Handles null/undefined, escapes quotes, and wraps in quotes if needed
 */
function formatCSVValue(value: any): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '""';
  }
  
  // Convert to string
  let str = String(value);
  
  // Escape double quotes by doubling them
  str = str.replace(/"/g, '""');
  
  // Wrap in quotes if contains comma, newline, or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str}"`;
  }
  
  // Wrap in quotes for safety (especially for Vietnamese text)
  return `"${str}"`;
}

/**
 * Common formatters for CSV export
 */
export const CSVFormatters = {
  /** Format number with fixed decimals */
  number: (decimals: number = 0) => (value: any) => {
    const num = Number(value);
    return isNaN(num) ? '""' : `"${num.toFixed(decimals)}"`;
  },
  
  /** Format percentage */
  percentage: (decimals: number = 1) => (value: any) => {
    const num = Number(value);
    return isNaN(num) ? '""' : `"${num.toFixed(decimals)}%"`;
  },
  
  /** Format date to Vietnamese format */
  date: (value: any) => {
    if (!value) return '""';
    try {
      const date = new Date(value);
      return `"${date.toLocaleDateString('vi-VN')}"`;
    } catch {
      return '""';
    }
  },
  
  /** Format boolean to Vietnamese */
  boolean: (trueLabel: string = 'Có', falseLabel: string = 'Không') => (value: any) => {
    return `"${value ? trueLabel : falseLabel}"`;
  },
  
  /** Format array to comma-separated string */
  array: (separator: string = ', ') => (value: any) => {
    if (!Array.isArray(value)) return '""';
    return `"${value.join(separator)}"`;
  },
  
  /** Format progress (X/Y) */
  progress: (value: any, row: any, completedKey: string, totalKey: string) => {
    const completed = row[completedKey] || 0;
    const total = row[totalKey] || 0;
    return `"${completed}/${total}"`;
  },
};

// Fixed UTF-8 BOM encoding
// Fixed UTF-8 BOM encoding
// Fixed UTF-8 BOM for Vietnamese
// Improved date formatting

// Fixed UTF-8 BOM
