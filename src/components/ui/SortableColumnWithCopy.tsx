'use client';

import React from 'react';
import { SortIcon } from './index';
import { CopyClassCodesButton } from './CopyClassCodesButton';
import styles from '@/app/dashboard.module.css';

interface SortableColumnWithCopyProps {
  label: string;
  sortKey: string;
  currentSortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: () => void;
  classCodes: string[];
  disabled?: boolean;
}

/**
 * Shared sortable column header with integrated copy button
 * Used for class name/code columns across multiple tables
 */
export function SortableColumnWithCopy({
  label,
  sortKey,
  currentSortKey,
  sortDir,
  onSort,
  classCodes,
  disabled = false,
}: SortableColumnWithCopyProps) {
  const isActive = sortKey === currentSortKey;

  return (
    <div
      className={`${styles.sortableCol} ${isActive ? styles.activeSort : ''}`}
      onClick={onSort}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <span>{label}</span>
      <SortIcon col={sortKey} sortKey={currentSortKey} sortDir={sortDir} />
      <CopyClassCodesButton
        classCodes={classCodes}
        disabled={disabled}
        size={12}
      />
    </div>
  );
}