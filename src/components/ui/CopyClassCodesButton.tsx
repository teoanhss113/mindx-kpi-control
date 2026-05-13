'use client';

import React, { useState } from 'react';
import { Icon } from './index';
import { LABELS } from '@/constants';
import styles from '@/app/dashboard.module.css';

interface CopyClassCodesButtonProps {
  classCodes: string[];
  disabled?: boolean;
  size?: number;
}

/**
 * Shared button component for copying all visible class codes to clipboard
 * Used in table headers across multiple pages (class-quality, completion-rate, teacher-change, etc.)
 */
export function CopyClassCodesButton({ classCodes, disabled = false, size = 12 }: CopyClassCodesButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    
    if (classCodes.length === 0) return;
    
    const text = classCodes.join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy class codes:', err);
    }
  };

  return (
    <button
      type="button"
      className={styles.tableActionBtn}
      onClick={handleCopy}
      title={copied ? LABELS.COPIED : LABELS.COPY_CLASS_CODE}
      aria-label={copied ? LABELS.COPIED : LABELS.COPY_CLASS_CODE}
      disabled={disabled || classCodes.length === 0}
      style={{ width: 22, height: 22 }}
    >
      {copied ? <Icon.Check size={size} /> : <Icon.Copy size={size} />}
    </button>
  );
}