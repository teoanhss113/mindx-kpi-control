'use client';

import React from 'react';
import styles from '@/app/dashboard.module.css';

export type FilterChipCountDisplay = 'active' | 'always' | 'never';

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number;
  countDisplay?: FilterChipCountDisplay;
  icon?: React.ReactNode;
}

export function FilterChip({
  active = false,
  count,
  countDisplay = 'always',
  icon,
  className,
  children,
  type = 'button',
  ...buttonProps
}: FilterChipProps) {
  const showBadge =
    countDisplay !== 'never' &&
    typeof count === 'number' &&
    (count > 0 || (count === 0 && countDisplay === 'always')) &&
    (countDisplay === 'always' || (countDisplay === 'active' && active));

  const classes = [styles.filterChip, active ? styles.chipActive : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...buttonProps}>
      {icon}
      {children}
      {showBadge && <span className={styles.chipBadge}>{count}</span>}
    </button>
  );
}
