'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/ui';
import styles from '@/app/dashboard.module.css';

interface ExemptionRulesPanelProps {
  title?: string;
  count?: number;
  isExpanded: boolean;
  onToggle: () => void;
  onReset: () => void;
  resetLabel?: string;
  children: ReactNode;
}

export function ExemptionRulesPanel({
  title = 'Quy tắc Miễn trừ',
  count,
  isExpanded,
  onToggle,
  onReset,
  resetLabel = 'Khôi phục quy tắc mặc định',
  children,
}: ExemptionRulesPanelProps) {
  return (
    <div className={styles.chartsSection}>
      <div className={styles.chartsSectionHeader} onClick={onToggle} style={{ cursor: 'pointer' }}>
        <div className={styles.chartsSectionTitle}>
          <Icon.CheckCircle size={15} />
          {title}
          {typeof count === 'number' && <span className={styles.groupBadge}>{count}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className={styles.chartToggle}
            aria-label={resetLabel}
            title={resetLabel}
            onClick={(event) => {
              event.stopPropagation();
              onReset();
            }}
          >
            <Icon.Refresh />
          </button>
          <Icon.ChevronDown
            size={16}
            color="var(--text-tertiary)"
            style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
