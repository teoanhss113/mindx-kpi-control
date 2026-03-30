/**
 * Export Button Component
 * 
 * Reusable button for exporting data to CSV with optional settings
 */

import React from 'react';
import { Icon } from './index';
import styles from './ExportButton.module.css';

interface ExportButtonProps {
  onClick: () => void;
  onSettingsClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  count?: number;
}

export function ExportButton({ 
  onClick,
  onSettingsClick,
  disabled = false, 
  loading = false,
  label = 'Export CSV',
  count
}: ExportButtonProps) {
  return (
    <div className={styles.exportBtnGroup}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={styles.exportBtn}
        title={count ? `Export ${count} rows to CSV` : 'Export to CSV'}
      >
        {loading ? (
          <>
            <div className={styles.spinner} />
            <span>Đang xuất...</span>
          </>
        ) : (
          <>
            <Icon.Download size={14} />
            <span>{label}</span>
            {count !== undefined && count > 0 && (
              <span className={styles.count}>({count})</span>
            )}
          </>
        )}
      </button>
      
      {onSettingsClick && (
        <button
          onClick={onSettingsClick}
          disabled={disabled}
          className={styles.settingsBtn}
          title="Cài đặt cột xuất"
        >
          <Icon.Settings size={14} />
        </button>
      )}
    </div>
  );
}
